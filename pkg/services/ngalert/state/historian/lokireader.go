package historian

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	alertingInstrument "github.com/grafana/alerting/http/instrument"
	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	ErrLokiQueryTooLong = errutil.BadRequest("loki.requestTooLong").MustTemplate(
		"Request to Loki exceeded ({{.Public.QuerySize}} bytes) configured maximum size of {{.Public.MaxLimit}} bytes. Query: {{.Private.Query}}",
		errutil.WithPublic("Query for Loki exceeded the configured limit of {{.Public.MaxLimit}} bytes. Remove some filters and try again."),
	)
)

func NewErrLokiQueryTooLong(query string, maxLimit int) error {
	return ErrLokiQueryTooLong.Build(errutil.TemplateData{
		Private: map[string]any{
			"Query": query,
		},
		Public: map[string]any{
			"MaxLimit":  maxLimit,
			"QuerySize": len(query),
		},
	})
}

type LokiReader struct {
	client    remoteLokiClient
	log       log.Logger
	ac        AccessControl
	ruleStore RuleStore
}

func NewLokiReader(logger log.Logger, cfg lokiclient.LokiConfig, req alertingInstrument.Requester, metrics *metrics.Historian, tracer tracing.Tracer, ruleStore RuleStore, ac AccessControl) *LokiReader {
	client := lokiclient.NewLokiClient(cfg, req, metrics.BytesWritten, metrics.WriteDuration, logger, tracer, LokiClientSpanName)

	return &LokiReader{
		client:    client,
		log:       logger,
		ac:        ac,
		ruleStore: ruleStore,
	}
}

// Query retrieves state history entries from an external Loki instance and formats the results into a dataframe.
func (h *LokiReader) Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	uids, err := h.getFolderUIDsForFilter(ctx, query)
	if err != nil {
		return nil, err
	}

	queries, err := BuildLogQuery(query, uids, h.client.MaxQuerySize())
	if err != nil {
		return nil, err
	}
	if len(queries) > 1 {
		h.log.FromContext(ctx).Info("Execute query in multiple batches", "batchSize", len(queries), "folders", len(uids), "maxQueryLimit", h.client.MaxQuerySize())
	}

	now := time.Now().UTC()
	if query.To.IsZero() {
		query.To = now
	}
	if query.From.IsZero() {
		query.From = now.Add(-defaultQueryRange)
	}
	var res []lokiclient.Stream
	for _, logQL := range queries {
		// Timestamps are expected in RFC3339Nano.
		// Apply user-defined limit to every request. Multiple batches is a very rare case, and therefore we can tolerate getting more data than needed.
		// The limit can be applied after all results are merged
		r, err := h.client.RangeQuery(ctx, logQL, query.From.UnixNano(), query.To.UnixNano(), int64(query.Limit))
		if err != nil {
			return nil, err
		}
		res = append(res, r.Data.Result...)
	}
	return h.merge(res, uids)
}

// merge will put all the results in one array sorted by timestamp.
func (h LokiReader) merge(res []lokiclient.Stream, folderUIDToFilter []string) (*data.Frame, error) {
	filterByFolderUIDMap := make(map[string]struct{}, len(folderUIDToFilter))
	for _, uid := range folderUIDToFilter {
		filterByFolderUIDMap[uid] = struct{}{}
	}

	// Find the total number of elements in all arrays.
	totalLen := 0
	for _, arr := range res {
		totalLen += len(arr.Values)
	}

	// Create a new slice to store the merged elements.
	frame := data.NewFrame("states")

	// We merge all series into a single linear history.
	lbls := data.Labels(map[string]string{})

	// We represent state history as a single merged history, that roughly corresponds to what you get in the Grafana Explore tab when querying Loki directly.
	// The format is composed of the following vectors:
	//   1. `time` - timestamp - when the transition happened
	//   2. `line` - JSON - the full data of the transition
	//   3. `labels` - JSON - the labels associated with that state transition
	times := make([]time.Time, 0, totalLen)
	lines := make([]json.RawMessage, 0, totalLen)
	labels := make([]json.RawMessage, 0, totalLen)

	// Initialize a slice of pointers to the current position in each array.
	pointers := make([]int, len(res))
	for {
		minTime := int64(math.MaxInt64)
		minEl := lokiclient.Sample{}
		minElStreamIdx := -1
		// Find the element with the earliest time among all arrays.
		for i, stream := range res {
			// Skip if we already reached the end of the current array.
			if len(stream.Values) == pointers[i] {
				continue
			}
			// check if stream should be in the results
			if len(filterByFolderUIDMap) > 0 {
				folderLbl, ok := stream.Stream[FolderUIDLabel]
				if !ok {
					continue // skip entries without folder UID, only if needs filtering
				}
				_, ok = filterByFolderUIDMap[folderLbl]
				if !ok {
					continue
				}
			}

			curTime := stream.Values[pointers[i]].T.UnixNano()
			if pointers[i] < len(stream.Values) && curTime < minTime {
				minTime = curTime
				minEl = stream.Values[pointers[i]]
				minElStreamIdx = i
			}
		}
		// If all pointers have reached the end of their arrays, we're done.
		if minElStreamIdx == -1 {
			break
		}
		entryBytes := []byte(minEl.V)
		var entry LokiEntry
		err := json.Unmarshal(entryBytes, &entry)
		if err != nil {
			h.log.Warn("failed to unmarshal entry, continuing", "err", err, "entry", minEl.V)
			pointers[minElStreamIdx]++
			continue
		}
		// Append the minimum element to the merged slice and move the pointer.
		tsNano := minEl.T.UnixNano()
		streamLbls := res[minElStreamIdx].Stream
		lblsJson, err := json.Marshal(streamLbls)
		if err != nil {
			// This should in theory never happen, as we're marshalling a map[string]string.
			h.log.Warn("failed to serialize stream labels, continuing", "err", err, "labels", streamLbls)
			pointers[minElStreamIdx]++
			continue
		}
		times = append(times, time.Unix(0, tsNano))
		labels = append(labels, lblsJson)
		lines = append(lines, json.RawMessage(entryBytes))
		pointers[minElStreamIdx]++
	}

	frame.Fields = append(frame.Fields, data.NewField(dfTime, lbls, times))
	frame.Fields = append(frame.Fields, data.NewField(dfLine, lbls, lines))
	frame.Fields = append(frame.Fields, data.NewField(dfLabels, lbls, labels))

	return frame, nil
}

func (h *LokiReader) getFolderUIDsForFilter(ctx context.Context, query models.HistoryQuery) ([]string, error) {
	bypass, err := h.ac.CanReadAllRules(ctx, query.SignedInUser)
	if err != nil {
		return nil, err
	}
	if bypass { // if user has access to all rules and folder, remove filter
		return nil, nil
	}
	// if there is a filter by rule UID, find that rule UID and make sure that user has access to it.
	if query.RuleUID != "" {
		rule, err := h.ruleStore.GetAlertRuleByUID(ctx, &models.GetAlertRuleByUIDQuery{
			UID:   query.RuleUID,
			OrgID: query.OrgID,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch alert rule by UID: %w", err)
		}
		if rule == nil {
			return nil, models.ErrAlertRuleNotFound
		}
		return nil, h.ac.AuthorizeAccessInFolder(ctx, query.SignedInUser, rule)
	}
	// if no filter, then we need to get all namespaces user has access to
	folders, err := h.ruleStore.GetUserVisibleNamespaces(ctx, query.OrgID, query.SignedInUser)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch folders that user can access: %w", err)
	}
	uids := make([]string, 0, len(folders))
	// now keep only UIDs of folder in which user can read rules.
	for _, f := range folders {
		hasAccess, err := h.ac.HasAccessInFolder(ctx, query.SignedInUser, models.Namespace(*f.ToFolderReference()))
		if err != nil {
			return nil, err
		}
		if !hasAccess {
			continue
		}
		uids = append(uids, f.UID)
	}
	if len(uids) == 0 {
		return nil, accesscontrol.NewAuthorizationErrorGeneric("read rules in any folder")
	}
	sort.Strings(uids)
	return uids, nil
}

// BuildLogQuery converts models.HistoryQuery and a list of folder UIDs to Loki queries.
// It can return multiple queries if the list of folder UIDs is too big to fit into single query.
// If there is a folder UID long enough to exceed a query size it returns ErrQueryTooLong.
func BuildLogQuery(query models.HistoryQuery, folderUIDs []string, maxQuerySize int) ([]string, error) {
	// first build tail of the query (if exists) to know what remaining capacity we have for folders
	tail, err := buildQueryTail(query)
	if err != nil {
		return nil, err
	}
	// build the base selectors. skip the closing bracket because we will append folders below. Closing bracket will be added at the end
	head := fmt.Sprintf(`{%s="%d",%s=%q`, OrgIDLabel, query.OrgID, StateHistoryLabelKey, StateHistoryLabelValue)

	// check if system-defined + user-defined query parameters do not exceed maximum size
	baseQuerySize := len(head) + 1 + len(tail) // 1 stands for closing bracket
	if len(head)+1+len(tail) > maxQuerySize {
		return nil, NewErrLokiQueryTooLong(head+"}"+tail, maxQuerySize)
	}

	// nothing to append to the head. Construct the query and return what we have
	if len(folderUIDs) == 0 {
		return []string{head + "}" + tail}, nil
	}
	remainingFolders := folderUIDs
	var result []string
	for len(remainingFolders) > 0 { // iterating until all folders are processed and at least one result
		// pre-calculate the size of the string to avoid excessive re-allocations
		requiredLengthEstimate := baseQuerySize + 1 + len(FolderUIDLabel) + 3 // 1 - comma, 3 - operator + opening backtick
		for _, folder := range remainingFolders {                             // this does not account to escaping characters because it's not expected generally
			requiredLengthEstimate += len(folder) + 1 // 1 - accounts to pipe-separator and  backtick at the end
			if requiredLengthEstimate > maxQuerySize {
				break
			}
		}
		s := strings.Builder{}
		s.Grow(requiredLengthEstimate)
		s.WriteString(head)
		s.WriteString(",")
		s.WriteString(FolderUIDLabel)
		s.WriteString("=~`")
		added := false
		for len(remainingFolders) > 0 {
			uid := regexp.QuoteMeta(remainingFolders[0])
			requiredLength := s.Len() + len(tail) + len(uid) + 2 // 2 - backtick + closing bracket
			if added {
				requiredLength++ // account to pipe symbol
			}
			if requiredLength > maxQuerySize {
				if !added {
					// finish the query for logging
					s.WriteString(uid)
					s.WriteString("`}")
					s.WriteString(tail)
					return nil, NewErrLokiQueryTooLong(s.String(), maxQuerySize)
				}
				break
			}
			if added {
				s.WriteString("|")
			}
			s.WriteString(uid)
			added = true
			remainingFolders = remainingFolders[1:]
		}
		s.WriteString("`")
		s.WriteString("}")
		s.WriteString(tail)
		result = append(result, s.String())
	}
	return result, nil
}

func buildQueryTail(query models.HistoryQuery) (string, error) {
	if !queryHasLogFilters(query) {
		return "", nil
	}
	b := strings.Builder{}
	b.WriteString(" | json")

	if query.RuleUID != "" {
		b.WriteString(" | ruleUID=")
		_, err := fmt.Fprintf(&b, "%q", query.RuleUID)
		if err != nil {
			return "", err
		}
	}
	if query.DashboardUID != "" {
		b.WriteString(" | dashboardUID=")
		_, err := fmt.Fprintf(&b, "%q", query.DashboardUID)
		if err != nil {
			return "", err
		}
	}
	if query.PanelID != 0 {
		b.WriteString(" | panelID=")
		b.WriteString(strconv.FormatInt(query.PanelID, 10))
	}
	if query.Previous != "" {
		b.WriteString(" | previous=~")
		_, err := fmt.Fprintf(&b, "%q", "^"+regexp.QuoteMeta(query.Previous)+".*")
		if err != nil {
			return "", err
		}
	}
	if query.Current != "" {
		b.WriteString(" | current=~")
		_, err := fmt.Fprintf(&b, "%q", "^"+regexp.QuoteMeta(query.Current)+".*")
		if err != nil {
			return "", err
		}
	}

	requiredSize := 0
	labelKeys := make([]string, 0, len(query.Labels))
	for k, v := range query.Labels {
		requiredSize += len(k) + len(v) + 13 // 13 all literals below
		labelKeys = append(labelKeys, k)
	}
	// Ensure that all queries we build are deterministic.
	sort.Strings(labelKeys)
	b.Grow(requiredSize)
	for _, k := range labelKeys {
		b.WriteString(" | labels_")
		b.WriteString(k)
		b.WriteString("=")
		_, err := fmt.Fprintf(&b, "%q", query.Labels[k])
		if err != nil {
			return "", err
		}
	}
	return b.String(), nil
}

func queryHasLogFilters(query models.HistoryQuery) bool {
	return query.RuleUID != "" ||
		query.DashboardUID != "" ||
		query.PanelID != 0 ||
		query.Previous != "" ||
		query.Current != "" ||
		len(query.Labels) > 0
}
