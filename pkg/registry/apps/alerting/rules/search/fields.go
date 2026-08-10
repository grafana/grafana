package search

import (
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Search request requirement keys and result column names shared by the legacy
// and unified backends (and the unified document builder). Title and folder
// reuse the standard search fields; the rest are rule-specific.
const (
	fieldName           = resource.SEARCH_FIELD_NAME
	fieldTitle          = resource.SEARCH_FIELD_TITLE
	fieldFolder         = resource.SEARCH_FIELD_FOLDER
	fieldInterval       = "interval"
	fieldPaused         = "paused"
	fieldType           = "type"
	fieldLabels         = "labels"
	fieldDatasourceUIDs = "datasourceUIDs"

	fieldAnnotations         = "annotations"
	fieldFor                 = "for"
	fieldKeepFiringFor       = "keepFiringFor"
	fieldDashboardUID        = "dashboardUID"
	fieldPanelID             = "panelID"
	fieldReceiver            = "receiver"
	fieldNotificationType    = "notificationType"
	fieldRoutingTree         = "routingTree"
	fieldMetric              = "metric"
	fieldTargetDatasourceUID = "targetDatasourceUID"
)

// resultColumns are the columns every search result table carries, in order.
// Kind-specific columns are empty for the other kind.
var resultColumns = []string{
	fieldType, fieldTitle, fieldFolder, fieldInterval, fieldPaused, fieldLabels, fieldDatasourceUIDs,
	fieldAnnotations, fieldFor, fieldKeepFiringFor,
	fieldDashboardUID, fieldPanelID, fieldReceiver, fieldNotificationType, fieldRoutingTree,
	fieldMetric, fieldTargetDatasourceUID,
}

// searchColumns is the column definition for every field a rule hit can carry,
// keyed by name.
var searchColumns = buildSearchColumns()

func buildSearchColumns() map[string]*resourcepb.ResourceTableColumnDefinition {
	std := resource.StandardSearchFields()
	// Seed the map with title and folder since these don't come from the kind definitions
	out := map[string]*resourcepb.ResourceTableColumnDefinition{
		fieldTitle:  std.Field(fieldTitle),
		fieldFolder: std.Field(fieldFolder),
	}

	provider := resource.NewManifestBackedProvider([]app.Manifest{rulesmanifest.LocalManifest()})
	for _, gr := range []schema.GroupResource{
		alertrule.ResourceInfo.GroupResource(),
		recordingrule.ResourceInfo.GroupResource(),
	} {
		// Empty Version asks for the union across every registered version of
		// the kind rather than pinning to whichever one the generated kind
		// reports today.
		gvr := schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}
		for _, col := range resource.SearchFieldDefinitionsToTableColumns(provider.Fields(gvr)) {
			// First declaration wins in case both kinds have diverging types on the same field.
			// TestSearchFieldsAgreeAcrossKinds tests that these stay consistent in code
			if _, ok := out[col.Name]; !ok {
				out[col.Name] = col
			}
		}
	}
	return out
}

// resultTable is the fixed shape of a legacy result table: the ordered column
// definitions, the position of each column by name, and the encoder for each
// position. The encoders come from the same TableBuilder the unified backend
// uses in hitsToTable, so both backends emit byte-identical cells.
type resultTable struct {
	defs     []*resourcepb.ResourceTableColumnDefinition
	index    map[string]int
	encoders []resource.ResourceColumnEncoder
	// skipped names columns dropped for want of a usable declaration. Their
	// fields go missing from hits; the rest of the table still works.
	skipped []string
	// err is set only when no table could be assembled at all, in which case
	// every legacy search fails rather than returning cell-less rows.
	err error
}

var results = buildResultTable()

func buildResultTable() resultTable {
	var t resultTable
	for _, name := range resultColumns {
		col, ok := searchColumns[name]
		// An undeclared or untyped column has no encoder, so it cannot carry a
		// cell. Drop it rather than failing every search.
		// Tests should catch this and prevent it in practice
		if !ok || col == nil || col.Type == resourcepb.ResourceTableColumnDefinition_UNKNOWN_TYPE {
			t.skipped = append(t.skipped, name)
			continue
		}
		t.defs = append(t.defs, col)
	}

	t.index = make(map[string]int, len(t.defs))
	for i, col := range t.defs {
		t.index[col.Name] = i
	}

	builder, err := resource.NewTableBuilder(t.defs)
	if err != nil {
		t.err = fmt.Errorf("building rule search result columns: %w", err)
		return t
	}
	t.encoders = builder.Encoders()
	return t
}

// resultColumnDefinitions returns the ordered column definitions for a legacy
// result table. The slice is shared and must not be mutated by callers.
func resultColumnDefinitions() []*resourcepb.ResourceTableColumnDefinition {
	return results.defs
}
