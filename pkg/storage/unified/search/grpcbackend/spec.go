package grpcbackend

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
)

var selectorOperators = map[selection.Operator]enginepb.SelectorOperator{
	selection.Equals:                    enginepb.SelectorOperator_SELECTOR_OPERATOR_EQUALS,
	selection.DoubleEquals:              enginepb.SelectorOperator_SELECTOR_OPERATOR_EXACT_EQUALS,
	selection.In:                        enginepb.SelectorOperator_SELECTOR_OPERATOR_IN,
	selection.NotIn:                     enginepb.SelectorOperator_SELECTOR_OPERATOR_NOT_IN,
	selection.GreaterThan:               enginepb.SelectorOperator_SELECTOR_OPERATOR_GREATER_THAN,
	resource.OperatorGreaterThanOrEqual: enginepb.SelectorOperator_SELECTOR_OPERATOR_GREATER_THAN_OR_EQUAL,
	selection.LessThan:                  enginepb.SelectorOperator_SELECTOR_OPERATOR_LESS_THAN,
	resource.OperatorLessThanOrEqual:    enginepb.SelectorOperator_SELECTOR_OPERATOR_LESS_THAN_OR_EQUAL,
	resource.OperatorRegex:              enginepb.SelectorOperator_SELECTOR_OPERATOR_REGEX,
	resource.OperatorNotRegex:           enginepb.SelectorOperator_SELECTOR_OPERATOR_NOT_REGEX,
}

func QuerySpec(req *resourcepb.ResourceSearchRequest, cutoff int64) (*enginepb.QuerySpec, error) {
	state := enginepb.DocumentState_DOCUMENT_STATE_LIVE
	if req.IsDeleted {
		state = enginepb.DocumentState_DOCUMENT_STATE_TRASH
	}
	query := &enginepb.QuerySpec{Text: req.Query, DocumentScope: &enginepb.DocumentScope{State: state}}
	if cutoff != 0 {
		query.DocumentScope.DeletionTimeCutoffUnixMs = new(cutoff)
	}
	for _, f := range req.QueryFields {
		query.QueryFields = append(query.QueryFields, &enginepb.QueryField{Name: f.GetName(), Boost: f.GetBoost()})
	}
	appendRequirement := func(key string, r *resourcepb.Requirement) error {
		if wire, ok := selectorOperators[selection.Operator(r.GetOperator())]; ok {
			query.Requirements = append(query.Requirements, &enginepb.Requirement{Key: key, Operator: wire, Values: r.GetValues()})
			return nil
		}
		return status.Errorf(codes.InvalidArgument, "unsupported search operator %q", r.GetOperator())
	}
	for _, r := range req.GetOptions().GetFields() {
		if r.GetKey() == resource.SEARCH_FIELD_FOLDER_TREE {
			return nil, status.Error(codes.Unimplemented, "folder-tree search is not supported yet")
		}
		if err := appendRequirement(r.GetKey(), r); err != nil {
			return nil, err
		}
	}
	for _, r := range req.GetOptions().GetLabels() {
		if err := appendRequirement(resource.SEARCH_FIELD_LABELS+"."+r.GetKey(), r); err != nil {
			return nil, err
		}
	}
	for _, sort := range req.SortBy {
		direction := enginepb.SortDirection_SORT_DIRECTION_ASCENDING
		if sort.GetDesc() {
			direction = enginepb.SortDirection_SORT_DIRECTION_DESCENDING
		}
		query.Sort = append(query.Sort, &enginepb.Sort{Field: sort.GetField(), Direction: direction})
	}
	return query, nil
}
