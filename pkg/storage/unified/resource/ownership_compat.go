package resource

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"
	searchmetrics "github.com/grafana/grafana/pkg/storage/unified/search/metrics"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
	"github.com/prometheus/client_golang/prometheus"
)

// These aliases preserve Go callers while the prototype establishes the new owners.
const ActionDelete = searchmodel.ActionDelete
const ActionIndex = searchmodel.ActionIndex

var ApplyManifests = searchmodel.ApplyManifests
var AsResourceKey = searchmodel.AsResourceKey

type TestDocumentBuilderSupplier = searchmodel.TestDocumentBuilderSupplier

var AssertTableSnapshot = searchmodel.AssertTableSnapshot

type BackendReadResponse = resourcecontract.BackendReadResponse
type BleveIndexMetrics = searchmetrics.IndexMetrics
type BlobSupport = resourcecontract.BlobSupport
type BuildFn = searchmodel.BuildFn
type BulkIndexItem = searchmodel.BulkIndexItem
type BulkIndexRequest = searchmodel.BulkIndexRequest

var CurrentIndexFeatures = searchmodel.CurrentIndexFeatures
var DecodeCell = searchmodel.DecodeCell
var DecodeSearchValues = searchmodel.DecodeSearchValues

type DocumentBuilder = searchmodel.DocumentBuilder
type DocumentBuilderInfo = searchmodel.DocumentBuilderInfo
type DocumentBuilderSupplier = searchmodel.DocumentBuilderSupplier
type DocumentRef = searchmodel.DocumentRef
type EmbeddingConfig = searchmodel.EmbeddingConfig
type EmbeddingConfigRegistry = searchmodel.EmbeddingConfigRegistry

var ErrBatchReadUnsupported = resourcecontract.ErrBatchReadUnsupported
var GlobalIndexCoversType = searchmodel.GlobalIndexCoversType
var GlobalSearchFieldDefinitions = searchmodel.GlobalSearchFieldDefinitions
var GlobalSearchFieldsHash = searchmodel.GlobalSearchFieldsHash

const GlobalSearchGroup = resourcecontract.GlobalSearchGroup

var GlobalSearchKey = resourcecontract.GlobalSearchKey

const GlobalSearchResource = resourcecontract.GlobalSearchResource

var GlobalSearchResourceTypes = searchmodel.GlobalSearchResourceTypes

type IndexAction = searchmodel.IndexAction
type IndexBuildInfo = searchmodel.IndexBuildInfo

var IndexCreationBuckets = searchmetrics.IndexCreationBuckets

type IndexFeature = searchmodel.IndexFeature

const IndexFeatureDeletedMarker = searchmodel.IndexFeatureDeletedMarker
const IndexFeatureHoldsDeletedDocuments = searchmodel.IndexFeatureHoldsDeletedDocuments
const IndexFeatureSortableTrashResourceVersion = searchmodel.IndexFeatureSortableTrashResourceVersion
const IndexFeatureStoredFacets = searchmodel.IndexFeatureStoredFacets
const IndexFeatureStoredResourceVersion = searchmodel.IndexFeatureStoredResourceVersion
const IndexFeatureTrashFields = searchmodel.IndexFeatureTrashFields

var IndexFieldDefinitions = searchmodel.IndexFieldDefinitions

const IndexPathBuild = searchmetrics.IndexPathBuild
const IndexPathTrash = searchmetrics.IndexPathTrash
const IndexPathUpdate = searchmetrics.IndexPathUpdate
const IndexPhaseCommit = searchmetrics.IndexPhaseCommit
const IndexPhaseConvert = searchmetrics.IndexPhaseConvert
const IndexPhaseFetch = searchmetrics.IndexPhaseFetch
const IndexPhaseMap = searchmetrics.IndexPhaseMap
const IndexPhasePromote = searchmetrics.IndexPhasePromote

var IndexReaderRequirements = searchmodel.IndexReaderRequirements

type IndexableDocument = searchmodel.IndexableDocument

const IndexedDocumentsDeleted = searchmetrics.IndexedDocumentsDeleted
const IndexedDocumentsLive = searchmetrics.IndexedDocumentsLive

var IsInternalSearchField = searchmodel.IsInternalSearchField
var IsTrashSearchField = searchmodel.IsTrashSearchField

type ListIterator = resourcecontract.ListIterator
type LowerGroupResource = resourcecontract.LowerGroupResource

var ManifestBackedProvider = searchmodel.ManifestBackedProvider
var ManifestResourceName = searchmodel.ManifestResourceName
var MergeManifestsByKind = searchmodel.MergeManifestsByKind
var MissingFeatures = searchmodel.MissingFeatures
var MissingIndexFeatures = searchmodel.MissingIndexFeatures

type ModifiedResource = resourcecontract.ModifiedResource
type NamespacedDocumentSupplier = searchmodel.NamespacedDocumentSupplier
type NamespacedResource = resourcecontract.NamespacedResource

var NewEmbeddingConfigRegistry = searchmodel.NewEmbeddingConfigRegistry
var NewIndexableDocument = searchmodel.NewIndexableDocument
var NewLowerGroupResource = resourcecontract.NewLowerGroupResource
var NewManifestBackedProvider = searchmodel.NewManifestBackedProvider
var NewMapProvider = searchmodel.NewMapProvider
var NewSearchFieldsRegistry = searchmodel.NewSearchFieldsRegistry
var NewSearchStats = searchmodel.NewSearchStats
var NewSearchableDocumentFields = searchmodel.NewSearchableDocumentFields
var NewTableBuilder = searchmodel.NewTableBuilder

const OperatorGreaterThanOrEqual = searchmodel.OperatorGreaterThanOrEqual
const OperatorLessThanOrEqual = searchmodel.OperatorLessThanOrEqual
const OperatorNotRegex = searchmodel.OperatorNotRegex
const OperatorRegex = searchmodel.OperatorRegex

// Existing Wire graphs require provider functions rather than function variables.
func ProvideIndexMetrics(reg prometheus.Registerer) *BleveIndexMetrics {
	return searchmetrics.ProvideIndexMetrics(reg)
}

func ProvideVectorMetrics(reg prometheus.Registerer) *VectorMetrics {
	return searchmetrics.ProvideVectorMetrics(reg)
}

var ReadSearchID = resourcecontract.ReadSearchID
var RequiredIndexFeatures = searchmodel.RequiredIndexFeatures

type ResourceColumnEncoder = searchmodel.ResourceColumnEncoder
type ResourceIndex = searchmodel.ResourceIndex
type ResourceLastImportTime = resourcecontract.ResourceLastImportTime
type ResourceReference = searchmodel.ResourceReference
type ResourceReferences = searchmodel.ResourceReferences
type ResourceStats = resourcecontract.ResourceStats

const SEARCH_FIELD_ALL_FIELDS = searchmodel.SEARCH_FIELD_ALL_FIELDS
const SEARCH_FIELD_CREATED = searchmodel.SEARCH_FIELD_CREATED
const SEARCH_FIELD_CREATED_BY = searchmodel.SEARCH_FIELD_CREATED_BY
const SEARCH_FIELD_DELETED_BY = searchmodel.SEARCH_FIELD_DELETED_BY
const SEARCH_FIELD_DELETED_RV = searchmodel.SEARCH_FIELD_DELETED_RV
const SEARCH_FIELD_DELETED_RV_SORT = searchmodel.SEARCH_FIELD_DELETED_RV_SORT
const SEARCH_FIELD_DELETION_TIME = searchmodel.SEARCH_FIELD_DELETION_TIME
const SEARCH_FIELD_DESCRIPTION = searchmodel.SEARCH_FIELD_DESCRIPTION
const SEARCH_FIELD_EXPLAIN = searchmodel.SEARCH_FIELD_EXPLAIN
const SEARCH_FIELD_FOLDER = searchmodel.SEARCH_FIELD_FOLDER
const SEARCH_FIELD_GROUP_RESOURCE = searchmodel.SEARCH_FIELD_GROUP_RESOURCE
const SEARCH_FIELD_ID = searchmodel.SEARCH_FIELD_ID
const SEARCH_FIELD_IS_DELETED = searchmodel.SEARCH_FIELD_IS_DELETED
const SEARCH_FIELD_IS_PROVISIONED = searchmodel.SEARCH_FIELD_IS_PROVISIONED
const SEARCH_FIELD_KIND = searchmodel.SEARCH_FIELD_KIND
const SEARCH_FIELD_LABELS = searchmodel.SEARCH_FIELD_LABELS
const SEARCH_FIELD_LEGACY_ID = searchmodel.SEARCH_FIELD_LEGACY_ID
const SEARCH_FIELD_MANAGED_BY = searchmodel.SEARCH_FIELD_MANAGED_BY
const SEARCH_FIELD_MANAGER_ID = searchmodel.SEARCH_FIELD_MANAGER_ID
const SEARCH_FIELD_MANAGER_KIND = searchmodel.SEARCH_FIELD_MANAGER_KIND
const SEARCH_FIELD_NAME = searchmodel.SEARCH_FIELD_NAME
const SEARCH_FIELD_NAMESPACE = searchmodel.SEARCH_FIELD_NAMESPACE
const SEARCH_FIELD_OWNER_REFERENCES = searchmodel.SEARCH_FIELD_OWNER_REFERENCES
const SEARCH_FIELD_PREFIX = searchmodel.SEARCH_FIELD_PREFIX
const SEARCH_FIELD_RV = searchmodel.SEARCH_FIELD_RV
const SEARCH_FIELD_RV_STRING = searchmodel.SEARCH_FIELD_RV_STRING
const SEARCH_FIELD_SCORE = searchmodel.SEARCH_FIELD_SCORE
const SEARCH_FIELD_SOURCE_CHECKSUM = searchmodel.SEARCH_FIELD_SOURCE_CHECKSUM
const SEARCH_FIELD_SOURCE_PATH = searchmodel.SEARCH_FIELD_SOURCE_PATH
const SEARCH_FIELD_SOURCE_TIME = searchmodel.SEARCH_FIELD_SOURCE_TIME
const SEARCH_FIELD_TAGS = searchmodel.SEARCH_FIELD_TAGS
const SEARCH_FIELD_TITLE = searchmodel.SEARCH_FIELD_TITLE
const SEARCH_FIELD_TITLE_NGRAM = searchmodel.SEARCH_FIELD_TITLE_NGRAM
const SEARCH_FIELD_TITLE_PHRASE = searchmodel.SEARCH_FIELD_TITLE_PHRASE
const SEARCH_FIELD_UPDATED = searchmodel.SEARCH_FIELD_UPDATED
const SEARCH_FIELD_UPDATED_BY = searchmodel.SEARCH_FIELD_UPDATED_BY
const SEARCH_SELECTABLE_FIELDS_PREFIX = searchmodel.SEARCH_SELECTABLE_FIELDS_PREFIX

type SearchBackend = searchmodel.SearchBackend
type SearchCapability = searchmodel.SearchCapability

const SearchCapabilityFacet = searchmodel.SearchCapabilityFacet
const SearchCapabilityFilter = searchmodel.SearchCapabilityFilter
const SearchCapabilityPartial = searchmodel.SearchCapabilityPartial
const SearchCapabilityRetrieve = searchmodel.SearchCapabilityRetrieve
const SearchCapabilitySort = searchmodel.SearchCapabilitySort
const SearchCapabilityText = searchmodel.SearchCapabilityText
const SearchCapabilityUnranked = searchmodel.SearchCapabilityUnranked

type SearchFieldDefinition = searchmodel.SearchFieldDefinition

var SearchFieldDefinitionsToTableColumns = searchmodel.SearchFieldDefinitionsToTableColumns
var SearchFieldProviders = searchmodel.SearchFieldProviders

type SearchFieldType = searchmodel.SearchFieldType

const SearchFieldTypeBoolean = searchmodel.SearchFieldTypeBoolean
const SearchFieldTypeDate = searchmodel.SearchFieldTypeDate
const SearchFieldTypeDouble = searchmodel.SearchFieldTypeDouble
const SearchFieldTypeInt64 = searchmodel.SearchFieldTypeInt64
const SearchFieldTypeString = searchmodel.SearchFieldTypeString
const SearchFieldTypeUnknown = searchmodel.SearchFieldTypeUnknown

var SearchFieldsForManifests = searchmodel.SearchFieldsForManifests
var SearchFieldsHashesForProviders = searchmodel.SearchFieldsHashesForProviders

type SearchFieldsProvider = searchmodel.SearchFieldsProvider
type SearchFieldsRegistry = searchmodel.SearchFieldsRegistry

var SearchID = resourcecontract.SearchID

type SearchOptions = searchmodel.SearchOptions
type SearchServer = searchmodel.SearchServer
type SearchStats = searchmodel.SearchStats
type SearchableDocumentFields = searchmodel.SearchableDocumentFields

var SearchableFieldsFromProvider = searchmodel.SearchableFieldsFromProvider
var SelectableFieldsForManifests = searchmodel.SelectableFieldsForManifests
var StandardDocumentBuilder = searchmodel.StandardDocumentBuilder
var StandardSearchFieldDefinitions = searchmodel.StandardSearchFieldDefinitions
var StandardSearchFields = searchmodel.StandardSearchFields

type TableBuilder = searchmodel.TableBuilder

var TableColumnsByName = searchmodel.TableColumnsByName
var TrashIndexFeatures = searchmodel.TrashIndexFeatures
var TrashSearchFieldDefinitions = searchmodel.TrashSearchFieldDefinitions

type TypeBuild = searchmodel.TypeBuild

var UnknownIndexRequirements = searchmodel.UnknownIndexRequirements

type UpdateFn = searchmodel.UpdateFn
type VectorMetrics = searchmetrics.VectorMetrics
