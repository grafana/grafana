package search

import (
	"strings"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"
	index "github.com/blevesearch/bleve_index_api"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func GetBleveMappings(fields resource.SearchableDocumentFields, selectableFields []string) (mapping.IndexMapping, error) {
	mapper := bleve.NewIndexMapping()
	mapper.DocValuesDynamic = false // only folder and title_phrase need DocValues
	mapper.ScoringModel = index.BM25Scoring

	err := RegisterCustomAnalyzers(mapper)
	if err != nil {
		return nil, err
	}
	mapper.DefaultMapping = getBleveDocMappings(fields, selectableFields)

	return mapper, nil
}

func getBleveDocMappings(fields resource.SearchableDocumentFields, selectableFields []string) *mapping.DocumentMapping {
	mapper := bleve.NewDocumentStaticMapping()

	nameMapping := &mapping.FieldMapping{
		Analyzer:     keyword.Name,
		Type:         "text",
		Index:        true,
		SkipFreqNorm: true,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_NAME, nameMapping)

	// for sorting by title full phrase
	titlePhraseMapping := bleve.NewKeywordFieldMapping()
	titlePhraseMapping.Store = false // already stored in title
	titlePhraseMapping.IncludeTermVectors = false
	titlePhraseMapping.SkipFreqNorm = true
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE_PHRASE, titlePhraseMapping)

	// for partial/prefix searching by title - uses ngram token filter
	titleNgramMapping := bleve.NewTextFieldMapping()
	titleNgramMapping.Analyzer = TITLE_ANALYZER
	titleNgramMapping.Store = false // already stored in title
	titleNgramMapping.DocValues = false
	titleNgramMapping.IncludeTermVectors = false
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE_NGRAM, titleNgramMapping)

	// for searching by title - uses ngram token filter
	// TODO: remove this once all clients query title_ngram directly
	titleSearchMapping := bleve.NewTextFieldMapping()
	titleSearchMapping.Analyzer = TITLE_ANALYZER
	titleSearchMapping.Store = false // already stored in title
	titleSearchMapping.DocValues = false
	titleSearchMapping.IncludeTermVectors = false

	// mapping for title to search on words/tokens larger than the ngram size
	titleWordMapping := bleve.NewTextFieldMapping()
	titleWordMapping.Analyzer = standard.Name
	titleWordMapping.Store = true
	titleWordMapping.DocValues = false
	titleWordMapping.IncludeTermVectors = false

	// separate keyword mapping for title (no DocValues — only the standalone title_phrase needs them)
	titleKeywordMapping := bleve.NewKeywordFieldMapping()
	titleKeywordMapping.Store = false
	titleKeywordMapping.DocValues = false
	titleKeywordMapping.IncludeTermVectors = false
	titleKeywordMapping.SkipFreqNorm = true

	// NOTE: this causes 3 title fields in the response
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE, titleWordMapping, titleSearchMapping, titleKeywordMapping)

	descriptionMapping := &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_DESCRIPTION,
		Type:               "text",
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
		SkipFreqNorm:       true,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_DESCRIPTION, descriptionMapping)

	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TAGS, &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_TAGS,
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
		SkipFreqNorm:       true,
	})

	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_OWNER_REFERENCES, &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_OWNER_REFERENCES,
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
		SkipFreqNorm:       true,
	})

	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_CREATED_BY, &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_CREATED_BY,
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
		SkipFreqNorm:       true,
	})

	folderMapping := &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_FOLDER,
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
		DocValues:          true, // will be needed for authz client
		SkipFreqNorm:       true,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_FOLDER, folderMapping)

	// Repositories
	manager := bleve.NewDocumentStaticMapping()
	manager.AddFieldMappingsAt("kind", &mapping.FieldMapping{
		Name:               "kind",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		SkipFreqNorm:       true,
	})
	manager.AddFieldMappingsAt("id", &mapping.FieldMapping{
		Name:               "id",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		SkipFreqNorm:       true,
	})

	source := bleve.NewDocumentStaticMapping()
	source.AddFieldMappingsAt("path", &mapping.FieldMapping{
		Name:               "path",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		SkipFreqNorm:       true,
	})
	source.AddFieldMappingsAt("checksum", &mapping.FieldMapping{
		Name:               "checksum",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		SkipFreqNorm:       true,
	})
	timestampMillisMapping := mapping.NewNumericFieldMapping()
	timestampMillisMapping.DocValues = false
	timestampMillisMapping.SkipFreqNorm = true
	source.AddFieldMappingsAt("timestampMillis", timestampMillisMapping)

	mapper.AddSubDocumentMapping("source", source)
	mapper.AddSubDocumentMapping("manager", manager)
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_MANAGED_BY, &mapping.FieldMapping{
		Name:               "managedBy",
		Type:               "text",
		Analyzer:           keyword.Name,
		Index:              true, // only used for faceting
		Store:              false,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		SkipFreqNorm:       true,
	})

	// NOTE: reference and labels use dynamic mappings because their keys aren't
	// known at mapping time. Bleve auto-creates fields using NewTextFieldMapping()
	// defaults (IncludeTermVectors:true, SkipFreqNorm:false). There's no way to
	// override these on a DocumentMapping — only on individual FieldMappings.
	referenceMapper := bleve.NewDocumentMapping()
	referenceMapper.DefaultAnalyzer = keyword.Name
	mapper.AddSubDocumentMapping("reference", referenceMapper)

	labelMapper := bleve.NewDocumentMapping()
	mapper.AddSubDocumentMapping(resource.SEARCH_FIELD_LABELS, labelMapper)

	fieldMapper := bleve.NewDocumentMapping()
	if fields != nil {
		for _, field := range fields.Fields() {
			def := fields.Field(field)

			// Filterable should use keyword analyzer for exact matches
			if def.Properties != nil && def.Properties.Filterable && def.Type == resourcepb.ResourceTableColumnDefinition_STRING {
				keywordMapping := bleve.NewKeywordFieldMapping()
				keywordMapping.Store = true
				keywordMapping.DocValues = false
				keywordMapping.IncludeTermVectors = false
				keywordMapping.SkipFreqNorm = true

				fieldMapper.AddFieldMappingsAt(def.Name, keywordMapping)
			}
			// For all other fields, we do nothing.
			// Bleve will see them at index time and dynamically map them as
			// numeric, datetime, boolean, or standard text based on their content.
		}
	}

	mapper.AddSubDocumentMapping(strings.TrimSuffix(resource.SEARCH_FIELD_PREFIX, "."), fieldMapper)

	// Disable bleve's internal "_all" composite field. By default bleve merges
	// terms from all fields with IncludeInAll:true into a synthetic "_all"
	// field. We never query it (all searches target explicit fields). Disabling
	// it significantly reduces index size.
	// https://github.com/blevesearch/bleve/blob/v2.5.7/mapping/index.go#L366-L371
	mapper.AddSubDocumentMapping("_all", bleve.NewDocumentDisabledMapping())

	selectableFieldsMapper := bleve.NewDocumentStaticMapping()
	for _, field := range selectableFields {
		selectableFieldsMapper.AddFieldMappingsAt(field, &mapping.FieldMapping{
			Name:               field,
			Type:               "text",
			Analyzer:           keyword.Name,
			Store:              false,
			Index:              true,
			IncludeTermVectors: false,
			SkipFreqNorm:       true,
		})
	}
	mapper.AddSubDocumentMapping(strings.TrimSuffix(resource.SEARCH_SELECTABLE_FIELDS_PREFIX, "."), selectableFieldsMapper)

	return mapper
}
