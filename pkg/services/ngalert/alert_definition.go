package ngalert

import "fmt"

// preSave sets datasource and loads the updated model for each alert query.
func (alertDefinition *AlertDefinition) preSave() error {
	for i, q := range alertDefinition.Data {
		err := q.PreSave()
		if err != nil {
			return fmt.Errorf("invalid alert query %s: %w", q.RefID, err)
		}
		alertDefinition.Data[i] = q
	}
	return nil
}
