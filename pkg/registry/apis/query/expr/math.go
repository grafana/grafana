package expr

import "github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"

var _ ExpressionQuery = (*MathQuery)(nil)

type MathQuery struct {
	// General math expression
	Expression string `json:"expression" jsonschema:"minLength=1,example=$A + 1,example=$A/$B"`

	// Parsed from the expression
	variables []string `json:"-"`
}

func (*MathQuery) ExpressionQueryType() QueryType {
	return QueryTypeMath
}

func (q *MathQuery) Variables() []string {
	return q.variables
}

func readMathQuery(version string, iter *jsoniter.Iterator) (q *MathQuery, err error) {
	fname := ""
	for fname, err = iter.ReadObject(); fname != "" && err == nil; fname, err = iter.ReadObject() {
		switch fname {
		case "expression":
			temp, err := iter.ReadString()
			if err != nil {
				return q, err
			}
			// TODO actually parse the expression
			q.Expression = temp

		default:
			_, err = iter.ReadAny() // eat up the unused fields
			if err != nil {
				return nil, err
			}
		}
	}
	return
}
