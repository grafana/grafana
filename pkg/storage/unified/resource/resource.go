package resource

import "fmt"

func (x *BatchResponse_Summary_Action) MarshalJSON() ([]byte, error) {
	v := fmt.Sprintf(`"%s"`, x.String())
	return []byte(v), nil
}

func (x *BatchResponse_Summary_Action) UnmarshalJSON(data []byte) error {
	i, ok := BatchResponse_Summary_Action_value[string(data)]
	if !ok {
		return fmt.Errorf("unknown action")
	}
	*x = BatchResponse_Summary_Action(i)
	return nil
}
