package expr

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/query"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type ExpressionQuery struct {
	RefID   string
	Command expr.Command
}

var _ query.TypedQueryReader[ExpressionQuery] = (*ExpressionQueyHandler)(nil)

type ExpressionQueyHandler struct {
	k8s   *v0alpha1.QueryTypeDefinitionList
	field string
}

//go:embed query.json
var f embed.FS

func NewQueryHandler() (*ExpressionQueyHandler, error) {
	h := &ExpressionQueyHandler{
		k8s: &v0alpha1.QueryTypeDefinitionList{},
	}

	body, err := f.ReadFile("query.json")
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(body, h.k8s)
	if err != nil {
		return nil, err
	}

	for _, qt := range h.k8s.Items {
		if h.field == "" {
			h.field = qt.Spec.DiscriminatorField
		} else if qt.Spec.DiscriminatorField != "" {
			if qt.Spec.DiscriminatorField != h.field {
				return nil, fmt.Errorf("only one discriminator field allowed")
			}
		}
	}

	return h, nil
}

// QueryTypes implements query.TypedQueryHandler.
func (h *ExpressionQueyHandler) QueryTypeDefinitionList() *v0alpha1.QueryTypeDefinitionList {
	return h.k8s
}

// ReadQuery implements query.TypedQueryHandler.
func (*ExpressionQueyHandler) ReadQuery(
	// Properties that have been parsed off the same node
	common query.CommonQueryProperties,
	// An iterator with context for the full node (include common values)
	iter *jsoniter.Iterator,
) (eq ExpressionQuery, err error) {
	eq.RefID = common.RefID
	qt := QueryType(common.QueryType)
	switch qt {
	case QueryTypeMath:
		q := &MathQuery{}
		err = iter.ReadVal(q)
		if err == nil {
			eq.Command, err = expr.NewMathCommand(common.RefID, q.Expression)
		}

	case QueryTypeReduce:
		var mapper mathexp.ReduceMapper = nil
		q := &ReduceQuery{}
		err = iter.ReadVal(q)
		if err == nil && q.Settings != nil {
			switch q.Settings.Mode {
			case ReduceModeDrop:
				mapper = mathexp.DropNonNumber{}
			case ReduceModeReplace:
				if q.Settings.ReplaceWithValue == nil {
					err = fmt.Errorf("setting replaceWithValue must be specified when mode is '%s'", q.Settings.Mode)
				}
				mapper = mathexp.ReplaceNonNumberWithValue{Value: *q.Settings.ReplaceWithValue}
			default:
				err = fmt.Errorf("unsupported reduce mode")
			}
		}
		if err == nil {
			eq.Command, err = expr.NewReduceCommand(common.RefID,
				string(q.Reducer),
				strings.TrimPrefix(q.Expression, "$"),
				mapper)
		}

	case QueryTypeResample:
		q := &ResampleQuery{}
		err = iter.ReadVal(q)
		if err == nil && common.TimeRange == nil {
			err = fmt.Errorf("missing time range in query")
		}
		if err == nil {
			tr := legacydata.NewDataTimeRange(common.TimeRange.From, common.TimeRange.To)
			eq.Command, err = expr.NewResampleCommand(common.RefID,
				q.Window,
				strings.TrimPrefix(q.Expression, "$"),
				q.Downsampler,
				q.Upsampler,
				expr.AbsoluteTimeRange{
					From: tr.GetFromAsTimeUTC(),
					To:   tr.GetToAsTimeUTC(),
				})
		}

	case QueryTypeClassic:
		q := &ClassicQuery{}
		err = iter.ReadVal(q)
		if err == nil {
			eq.Command, err = classic.NewConditionCmd(common.RefID, q.Conditions)
		}

	default:
		err = fmt.Errorf("unknown query type")
	}
	return
}
