package ngalert

// preSave sets datasource and loads the updated model for each alert query.
func (alertDefinition *AlertDefinition) preSave() error {
	for i, q := range alertDefinition.Data {
		err := q.PreSave(alertDefinition.OrgId)
		if err != nil {
			return err
		}
		alertDefinition.Data[i] = q
	}
	return nil
}
