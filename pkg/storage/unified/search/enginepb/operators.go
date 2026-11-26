package enginepb

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apimachinery/pkg/selection"
)

var selectorOperators = map[SelectorOperator]selection.Operator{
	SelectorOperator_SELECTOR_OPERATOR_EQUALS:                selection.Equals,
	SelectorOperator_SELECTOR_OPERATOR_EXACT_EQUALS:          selection.DoubleEquals,
	SelectorOperator_SELECTOR_OPERATOR_IN:                    selection.In,
	SelectorOperator_SELECTOR_OPERATOR_NOT_IN:                selection.NotIn,
	SelectorOperator_SELECTOR_OPERATOR_GREATER_THAN:          selection.GreaterThan,
	SelectorOperator_SELECTOR_OPERATOR_GREATER_THAN_OR_EQUAL: resource.OperatorGreaterThanOrEqual,
	SelectorOperator_SELECTOR_OPERATOR_LESS_THAN:             selection.LessThan,
	SelectorOperator_SELECTOR_OPERATOR_LESS_THAN_OR_EQUAL:    resource.OperatorLessThanOrEqual,
	SelectorOperator_SELECTOR_OPERATOR_REGEX:                 resource.OperatorRegex,
	SelectorOperator_SELECTOR_OPERATOR_NOT_REGEX:             resource.OperatorNotRegex,
}

func SelectorName(op SelectorOperator) (selection.Operator, bool) {
	name, ok := selectorOperators[op]
	return name, ok
}

func ParseSelectorName(name string) (SelectorOperator, bool) {
	for op, value := range selectorOperators {
		if string(value) == name {
			return op, true
		}
	}
	return SelectorOperator_SELECTOR_OPERATOR_UNSPECIFIED, false
}
