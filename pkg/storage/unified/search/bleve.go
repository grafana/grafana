package search

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"path/filepath"
	"reflect"
	"strings"
	"sync"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const tracingPrexfixBleve = "unified_search.bleve."

var _ resource.SearchBackend = &bleveBackend{}
var _ resource.ResourceIndex = &bleveIndex{}

type bleveOptions struct {
	// The root folder where file objects are saved
	Root string

	// The resource count where values switch from memory to file based
	FileThreshold int64

	// How big should a batch get before flushing
	// ?? not totally sure the units
	BatchSize int
}

type bleveBackend struct {
	tracer trace.Tracer
	log    *slog.Logger
	opts   bleveOptions

	// cache info
	cache   map[resource.NamespacedResource]*bleveIndex
	cacheMu sync.RWMutex
}

func NewBleveBackend(opts bleveOptions, tracer trace.Tracer, reg prometheus.Registerer) *bleveBackend {
	b := &bleveBackend{
		log:    slog.Default().With("logger", "bleve-backend"),
		tracer: tracer,
		cache:  make(map[resource.NamespacedResource]*bleveIndex),
		opts:   opts,
	}

	if reg != nil {
		b.log.Info("TODO, register metrics collectors!")
	}

	return b
}

// This will return nil if the key does not exist
func (b *bleveBackend) GetIndex(ctx context.Context, key resource.NamespacedResource) (resource.ResourceIndex, error) {
	b.cacheMu.RLock()
	defer b.cacheMu.RUnlock()

	idx, ok := b.cache[key]
	if ok {
		return idx, nil
	}
	return nil, nil
}

// Build an index from scratch
func (b *bleveBackend) BuildIndex(ctx context.Context,
	key resource.NamespacedResource,

	// When the size is known, it will be passed along here
	// Depending on the size, the backend may choose different options (eg: memory vs disk)
	size int64,

	// The last known resource version can be used to know that we can skip calling the builder
	resourceVersion int64,

	// The builder will write all documents before returning
	builder func(index resource.ResourceIndex) (int64, error),
) (resource.ResourceIndex, error) {
	b.cacheMu.Lock()
	defer b.cacheMu.Unlock()

	_, span := b.tracer.Start(ctx, tracingPrexfixBleve+"BuildIndex")
	defer span.End()

	var err error
	var index bleve.Index
	mapping := bleve.NewIndexMapping() // auto-magic
	if size > b.opts.FileThreshold {
		dir := filepath.Join(b.opts.Root, key.Namespace, fmt.Sprintf("%s.%s", key.Resource, key.Group))
		index, err = bleve.New(dir, mapping)
		if err == nil {
			b.log.Info("TODO, check last RV so we can see if the numbers have changed", "dir", dir)
		}
	} else {
		index, err = bleve.NewMemOnly(mapping)
	}
	if err != nil {
		return nil, err
	}

	// Batch all the changes
	idx := &bleveIndex{
		key:       key,
		index:     index,
		batch:     index.NewBatch(),
		batchSize: b.opts.BatchSize,
	}
	_, err = builder(idx)
	if err != nil {
		return nil, err
	}

	// Flush the batch
	err = idx.Flush()
	if err != nil {
		return nil, err
	}

	b.cache[key] = idx
	return idx, nil
}

type bleveIndex struct {
	key   resource.NamespacedResource
	index bleve.Index

	// only valid in single thread
	batch     *bleve.Batch
	batchSize int // ??? not totally sure the units here
}

// Write implements resource.DocumentIndex.
func (b *bleveIndex) Write(doc resource.IndexableDocument) error {
	if b.batch != nil {
		err := b.batch.Index(doc.GetID(), doc)
		if err != nil {
			return err
		}
		if b.batch.Size() > b.batchSize {
			err = b.index.Batch(b.batch)
			b.batch.Reset() // clear the batch
		}
		return err // nil
	}
	return b.index.Index(doc.GetID(), doc)
}

// Delete implements resource.DocumentIndex.
func (b *bleveIndex) Delete(key *resource.ResourceKey) error {
	if b.batch != nil {
		return fmt.Errorf("unexpected delete while building batch")
	}
	return b.index.Delete(toID(key))
}

// Flush implements resource.DocumentIndex.
func (b *bleveIndex) Flush() (err error) {
	if b.batch != nil {
		err = b.index.Batch(b.batch)
		b.batch.Reset()
		b.batch = nil
	}
	return err
}

// Origin implements resource.DocumentIndex.
func (b *bleveIndex) Origin(ctx context.Context, req *resource.OriginRequest) (*resource.OriginResponse, error) {
	panic("unimplemented")
}

// Search implements resource.DocumentIndex.
func (b *bleveIndex) Search(
	ctx context.Context,
	access authz.AccessClient,
	req *resource.ResourceSearchRequest,
	federate []resource.ResourceIndex, // For federated queries, these will match the values in req.federate
) (*resource.ResourceSearchResponse, error) {
	if req.Options == nil || req.Options.Key == nil {
		return &resource.ResourceSearchResponse{
			Error: resource.NewBadRequestError("missing query key"),
		}, nil
	}

	response := &resource.ResourceSearchResponse{
		Error: b.verifyKey(req.Options.Key),
	}
	if response.Error != nil {
		return response, nil
	}

	// Verifies the index federation
	index, err := b.getIndex(req, federate)
	if err != nil {
		return nil, err
	}

	// convert protobuf request to bleve request
	searchrequest, e := toBleveSearchRequest(req, access)
	if e != nil {
		response.Error = e
		return response, nil
	}

	// Show all fields when nothing is selected
	if len(searchrequest.Fields) < 1 && req.Limit > 0 {
		f, err := b.index.Fields()
		if err != nil {
			return nil, err
		}
		searchrequest.Fields = f
	}

	res, err := index.Search(searchrequest)
	if err != nil {
		return nil, err
	}

	response.TotalHits = res.Total
	response.QueryCost = res.Cost
	response.MaxScore = res.MaxScore

	// Convert the hits to a data frame
	frame, err := hitsToFrame(searchrequest.Fields, res.Hits, req.Explain)
	if err != nil {
		return nil, err
	}

	// Write frame as JSON
	response.Frame, err = frame.MarshalJSON()
	if err != nil {
		return nil, err
	}

	// parse the facet fields
	for k, v := range res.Facets {
		f := &resource.ResourceSearchResponse_Facet{
			Field:   v.Field,
			Total:   int64(v.Total),
			Missing: int64(v.Missing),
		}
		if v.Terms != nil {
			for _, t := range v.Terms.Terms() {
				f.Terms = append(f.Terms, &resource.ResourceSearchResponse_TermFacet{
					Term:  t.Term,
					Count: int64(t.Count),
				})
			}
		}
		if response.Facet == nil {
			response.Facet = make(map[string]*resource.ResourceSearchResponse_Facet)
		}
		response.Facet[k] = f
	}
	return response, nil
}

// make sure the request key matches the index
func (b *bleveIndex) verifyKey(key *resource.ResourceKey) *resource.ErrorResult {
	if key.Namespace != b.key.Namespace {
		return resource.NewBadRequestError("namespace mismatch (expected " + b.key.Namespace + ")")
	}
	if key.Group != b.key.Group {
		return resource.NewBadRequestError("group mismatch (expected " + b.key.Group + ")")
	}
	if key.Resource != b.key.Resource {
		return resource.NewBadRequestError("resource mismatch (expected " + b.key.Resource + ")")
	}
	return nil
}

func (b *bleveIndex) getIndex(
	req *resource.ResourceSearchRequest,
	federate []resource.ResourceIndex,
) (bleve.Index, error) {
	if len(req.Federated) != len(federate) {
		return nil, fmt.Errorf("federation is misconfigured")
	}

	// Search across resources using
	// https://blevesearch.com/docs/IndexAlias/
	if len(federate) > 0 {
		all := []bleve.Index{b.index}
		for i, extra := range federate {
			typedindex, ok := extra.(*bleveIndex)
			if !ok {
				return nil, fmt.Errorf("federated indexes must be the same type")
			}
			if typedindex.verifyKey(req.Federated[i]) != nil {
				return nil, fmt.Errorf("federated index keys do not match")
			}
			all = append(all, typedindex.index)
		}
		return bleve.NewIndexAlias(all...), nil
	}
	return b.index, nil
}

func toBleveSearchRequest(req *resource.ResourceSearchRequest, access authz.AccessClient) (*bleve.SearchRequest, *resource.ErrorResult) {
	searchrequest := &bleve.SearchRequest{
		Fields:  req.Fields,
		Size:    int(req.Limit),
		From:    int(req.Offset),
		Explain: req.Explain,
	}

	// Currently everything is within an AND query
	queries := []query.Query{}
	if len(req.Options.Labels) > 0 {
		for _, v := range req.Options.Labels {
			q, err := requirementQuery(v, "labels.")
			if err != nil {
				return nil, err
			}
			queries = append(queries, q)
		}
	}
	if len(req.Options.Fields) > 0 {
		for _, v := range req.Options.Fields {
			q, err := requirementQuery(v, "")
			if err != nil {
				return nil, err
			}
			queries = append(queries, q)
		}
	}

	if req.Query != "" {
		// ??? Should expose the full power of query parsing here?
		// it is great for exploration, but also hard to change in the future
		q := bleve.NewQueryStringQuery(req.Query)
		queries = append(queries, q)
	}

	if access != nil {
		// TODO AUTHZ!!!!
		// Need to add an authz filter into the mix
		// See: https://github.com/grafana/grafana/blob/v11.3.0/pkg/services/searchV2/bluge.go
		// NOTE, we likely want to pass in the already called checker because the resource server
		// will first need to check if we can see anything (or everything!) for this resource
		fmt.Printf("TODO... check authorization")
	}

	switch len(queries) {
	case 0:
		searchrequest.Query = bleve.NewMatchAllQuery()
	case 1:
		searchrequest.Query = queries[0]
	default:
		searchrequest.Query = bleve.NewConjunctionQuery(queries...) // AND
	}

	for k, v := range req.Facet {
		if searchrequest.Facets == nil {
			searchrequest.Facets = make(bleve.FacetsRequest)
		}
		searchrequest.Facets[k] = bleve.NewFacetRequest(v.Field, int(v.Limit))
	}

	// Add the sort fields
	for _, sort := range req.SortBy {
		if sort.Field == "title" {
			// ???? is this doing anything????
			searchrequest.Sort = append(searchrequest.Sort, &search.SortField{
				Field:   "title",
				Desc:    sort.Desc,
				Type:    search.SortFieldAsString, // force for title????
				Mode:    search.SortFieldDefault,  // ???
				Missing: search.SortFieldMissingLast,
			})
			continue
		}

		// hardcoded (for now)
		if strings.HasPrefix(sort.Field, "stats.") {
			searchrequest.Sort = append(searchrequest.Sort, &search.SortField{
				Field:   sort.Field,
				Desc:    sort.Desc,
				Type:    search.SortFieldAsNumber, // force for now!
				Mode:    search.SortFieldDefault,  // ???
				Missing: search.SortFieldMissingLast,
			})
			continue
		}

		// Default support
		input := sort.Field
		if sort.Desc {
			input = "-" + sort.Field
		}
		s := search.ParseSearchSortString(input)
		searchrequest.Sort = append(searchrequest.Sort, s)
	}

	// Always sort by *something*, otherwise the order is unstable
	if len(searchrequest.Sort) == 0 {
		searchrequest.Sort = append(searchrequest.Sort, &search.SortDocID{
			Desc: false,
		})
	}

	if true { // debugging, what is happening!!
		jj, _ := json.MarshalIndent(searchrequest.Sort, "", "  ")
		fmt.Printf("SORT: %s\n", jj)
	}

	return searchrequest, nil
}

// Convert a "requirement" into a bleve query
func requirementQuery(req *resource.Requirement, prefix string) (query.Query, *resource.ErrorResult) {
	switch selection.Operator(req.Operator) {
	case selection.Equals, selection.DoubleEquals:
		if len(req.Values) != 1 {
			return nil, resource.NewBadRequestError("equals query can have one value")
		}
		q := query.NewMatchQuery(req.Values[0])
		q.FieldVal = prefix + req.Key
		return q, nil

	case selection.NotEquals:
	case selection.DoesNotExist:
	case selection.GreaterThan:
	case selection.LessThan:
	case selection.Exists:
	case selection.In:
	case selection.NotIn:
	}
	return nil, resource.NewBadRequestError(
		fmt.Sprintf("unsupported query operation (%s %s %v)", req.Key, req.Operator, req.Values),
	)
}

func hitsToFrame(selectFields []string, hits search.DocumentMatchCollection, explain bool) (*data.Frame, error) {
	// HACK, for now...
	// it looks like array with one value is a string,
	// but an array with two is an array.  So discovering the type
	// using `data.FieldTypeFor(v)` is not a great long term solution
	forceJSONArray := map[string]bool{
		"tags": true,
	}

	size := hits.Len()
	frame := data.NewFrame("")
	for _, fname := range selectFields {
		var field *data.Field
		isJSON := false // for arrays
		isForceJSONArray := forceJSONArray[fname]

		for row, hit := range hits {
			v, ok := hit.Fields[fname]
			if ok {
				if field == nil {
					// Add a field if any value exists
					ftype := data.FieldTypeFor(v)
					if ftype == data.FieldTypeUnknown || isForceJSONArray {
						ftype = data.FieldTypeJSON
						isJSON = true
					} else if row > 0 {
						ftype = ftype.NullableType()
					}

					field = data.NewFieldFromFieldType(ftype, size)
					field.Name = fname
				}

				// Use json to support multi-valued fields
				if isJSON {
					if isForceJSONArray {
						// currently single values are not arrays
						k := reflect.TypeOf(v).Kind()
						if !(k == reflect.Array || k == reflect.Slice) {
							v = []any{v}
						}
					}
					jj, _ := json.Marshal(v)
					field.SetConcrete(row, json.RawMessage(jj))
				} else {
					field.SetConcrete(row, v)
				}
			} else {
				// Swap nullable type if missing
				if field != nil && !field.Nullable() && !isJSON {
					tmp := data.NewFieldFromFieldType(field.Type().NullableType(), size)
					for i := 0; i < row; i++ {
						tmp.SetConcrete(i, field.At(i)) // replace the
					}
					field = tmp
				}
			}
		}

		if field != nil {
			// Do not include all empty strings
			if field.Type() == data.FieldTypeString {
				allEmpty := true
				for i := 0; i < size; i++ {
					if field.At(i) != "" {
						allEmpty = false
						break
					}
				}
				if allEmpty {
					continue
				}
			}
			frame.Fields = append(frame.Fields, field)
		}
	}

	// Add the explain field
	if explain {
		field := data.NewFieldFromFieldType(data.FieldTypeJSON, size)
		field.Name = "explain"
		for row, hit := range hits {
			if hit.Expl != nil {
				js, _ := json.Marshal(hit.Expl)
				if len(js) > 0 {
					field.Set(row, json.RawMessage(js))
				}
			}
		}
	}

	return frame, nil
}
