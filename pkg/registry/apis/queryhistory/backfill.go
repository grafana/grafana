package queryhistory

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/k8s"
	sdkresource "github.com/grafana/grafana-app-sdk/resource"
	collectionsv1alpha1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	queryhistoryapp "github.com/grafana/grafana/apps/queryhistory/pkg/app"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/org"
	queryhistorysvc "github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	restclient "k8s.io/client-go/rest"
)

type BackfillJob struct {
	store       db.DB
	userService user.Service
	orgService  org.Service
	qhClient    *qhv0alpha1.QueryHistoryClient
	starsClient *collectionsv1alpha1.StarsClient
	logger      *slog.Logger
	batchSize   int
	restConfig  *restclient.Config
}

func (b *BackfillJob) SetRestConfig(cfg restclient.Config) {
	b.restConfig = &cfg
}

func NewBackfillJob(
	store db.DB,
	userSvc user.Service,
	orgSvc org.Service,
) *BackfillJob {
	return &BackfillJob{
		store:       store,
		userService: userSvc,
		orgService:  orgSvc,
		logger:      slog.Default().With("component", "queryhistory-backfill"),
		batchSize:   500,
	}
}

// Run processes all legacy query history rows in batches.
// Idempotent: skips resources that already exist (by UID).
func (b *BackfillJob) Run(ctx context.Context) error {
	if b.restConfig != nil {
		gen := k8s.NewClientRegistry(*b.restConfig, k8s.DefaultClientConfig())
		if b.qhClient == nil {
			client, err := qhv0alpha1.NewQueryHistoryClientFromGenerator(gen)
			if err != nil {
				return fmt.Errorf("failed to create query history client: %w", err)
			}
			b.qhClient = client
		}
		if b.starsClient == nil {
			client, err := collectionsv1alpha1.NewStarsClientFromGenerator(gen)
			if err != nil {
				return fmt.Errorf("failed to create stars client: %w", err)
			}
			b.starsClient = client
		}
	}

	b.logger.Info("starting query history backfill")

	// Build a map of org ID → namespace for namespace resolution.
	namespaces, err := b.buildNamespaceMap(ctx)
	if err != nil {
		return fmt.Errorf("failed to build namespace map: %w", err)
	}

	offset := 0
	totalCreated := 0
	totalSkipped := 0

	for {
		var rows []queryhistorysvc.QueryHistory
		err := b.store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.Table("query_history").
				OrderBy("id ASC").
				Limit(b.batchSize, offset).
				Find(&rows)
		})
		if err != nil {
			return fmt.Errorf("failed to read legacy query history batch at offset %d: %w", offset, err)
		}
		if len(rows) == 0 {
			break
		}

		// Collect unique user IDs for this batch.
		userIDs := make(map[int64]struct{})
		for _, row := range rows {
			userIDs[row.CreatedBy] = struct{}{}
		}

		// Batch-lookup user UIDs.
		userUIDMap, err := b.lookupUserUIDs(ctx, userIDs)
		if err != nil {
			b.logger.Error("failed to lookup user UIDs", "error", err)
			offset += len(rows)
			continue
		}

		// Load stars for this batch.
		starSet, err := b.loadStars(ctx, rows)
		if err != nil {
			b.logger.Error("failed to load stars", "error", err)
			offset += len(rows)
			continue
		}

		for _, row := range rows {
			namespace, ok := namespaces[row.OrgID]
			if !ok {
				b.logger.Warn("unknown org for query history row", "orgID", row.OrgID, "uid", row.UID)
				continue
			}

			userUID, ok := userUIDMap[row.CreatedBy]
			if !ok {
				b.logger.Warn("unknown user for query history row", "userID", row.CreatedBy, "uid", row.UID)
				continue
			}

			starred := starSet[row.UID]
			created, err := b.createResource(ctx, row, namespace, userUID, starred)
			if err != nil {
				b.logger.Error("failed to create query history resource", "uid", row.UID, "error", err)
				continue
			}
			if created {
				totalCreated++
			} else {
				totalSkipped++
			}
		}

		offset += len(rows)

		if len(rows) < b.batchSize {
			break
		}
	}

	b.logger.Info("query history backfill complete", "created", totalCreated, "skipped", totalSkipped)
	return nil
}

func (b *BackfillJob) buildNamespaceMap(ctx context.Context) (map[int64]string, error) {
	result := map[int64]string{}
	orgs, err := b.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return nil, err
	}
	for _, o := range orgs {
		result[o.ID] = fmt.Sprintf("org-%d", o.ID)
	}
	return result, nil
}

func (b *BackfillJob) lookupUserUIDs(ctx context.Context, userIDs map[int64]struct{}) (map[int64]string, error) {
	result := map[int64]string{}
	for userID := range userIDs {
		u, err := b.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
		if err != nil {
			b.logger.Warn("failed to lookup user", "userID", userID, "error", err)
			continue
		}
		result[userID] = u.UID
	}
	return result, nil
}

// loadStars returns a set of query UIDs that have at least one star in this batch.
func (b *BackfillJob) loadStars(ctx context.Context, rows []queryhistorysvc.QueryHistory) (map[string]bool, error) {
	uids := make([]string, len(rows))
	for i, r := range rows {
		uids[i] = r.UID
	}

	var stars []queryhistorysvc.QueryHistoryStar
	err := b.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table("query_history_star").
			In("query_uid", uids).
			Find(&stars)
	})
	if err != nil {
		return nil, err
	}

	result := map[string]bool{}
	for _, s := range stars {
		result[s.QueryUID] = true
	}
	return result, nil
}

func (b *BackfillJob) createResource(ctx context.Context, row queryhistorysvc.QueryHistory, namespace, userUID string, starred bool) (bool, error) {
	labels := map[string]string{
		queryhistoryapp.LabelCreatedBy:     userUID,
		queryhistoryapp.LabelDatasourceUID: row.DatasourceUID,
	}

	if starred {
		labels[queryhistoryapp.LabelStarCount] = "1"
	} else {
		// Set TTL based on original creation time.
		expiresAt := row.CreatedAt + int64(queryhistoryapp.DefaultTTL.Seconds())
		labels[queryhistoryapp.LabelExpiresAt] = strconv.FormatInt(expiresAt, 10)
	}

	var queriesRaw interface{}
	if row.Queries != nil {
		b, err := row.Queries.MarshalJSON()
		if err != nil {
			return false, fmt.Errorf("failed to marshal queries: %w", err)
		}
		if err := json.Unmarshal(b, &queriesRaw); err != nil {
			return false, fmt.Errorf("failed to unmarshal queries: %w", err)
		}
	}

	comment := row.Comment
	obj := &qhv0alpha1.QueryHistory{
		TypeMeta: metav1.TypeMeta{
			APIVersion: qhv0alpha1.GroupVersion.Identifier(),
			Kind:       qhv0alpha1.QueryHistoryKind().Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              row.UID,
			Namespace:         namespace,
			Labels:            labels,
			CreationTimestamp: metav1.NewTime(time.Unix(row.CreatedAt, 0)),
		},
		Spec: qhv0alpha1.QueryHistorySpec{
			DatasourceUid: row.DatasourceUID,
			Queries:       queriesRaw,
			Comment:       &comment,
		},
	}

	_, err := b.qhClient.Create(ctx, obj, sdkresource.CreateOptions{})
	if err != nil {
		if errors.IsAlreadyExists(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}
