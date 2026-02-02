/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by ateli at 10/02/2022
 */

package sqlstore

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetCalculatedFields(ctx context.Context, query *models.GetCalculatedFields) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.CalculatedFields, 0)
		sess := dbSession.Table("calculatedfield")
		rawsql := "select t1.* from (" +
			"select cf.id,cf.org_id,cf.form_name,cf.module,cf.name,cf.sql_query,cf.aggregation, 'OOTB' as field_type  from calculatedfield cf " +
			"UNION ALL " +
			"select ccf.id,ccf.org_id,ccf.form_name,ccf.module,ccf.name,ccf.sql_query,ccf.aggregation, 'CUSTOM' as field_type  from custom_calculatedfields ccf" +
			") as t1 "
		rawsql += fmt.Sprintf(" WHERE t1.org_id in (1, %d)", query.OrgId)
		if err := sess.SQL(rawsql).Find(&results); err != nil {
			return err
		}
		query.Result = results
		return nil
	})

}

func (ss *SQLStore) CreateCalculatedField(ctx context.Context, cmd *models.CreateCalcFieldCmd) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSession *DBSession) error {
		sess := dbSession.Table("custom_calculatedfields")
		_, err := sess.Insert(cmd)
		if err != nil {
			return err
		}
		return nil
	})
}

func (ss *SQLStore) DeletelatedFields(ctx context.Context, cmd *models.DeleteCalcFieldsByIds) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		sess := dbSession.Table("custom_calculatedfields")
		if _, err := sess.Table("custom_calculatedfields").
			Where("custom_calculatedfields.org_id = ?", cmd.OrgId).
			In("custom_calculatedfields.id", cmd.Ids).Delete(struct{}{}); err != nil {
			return err
		}

		return nil
	})
}

func (ss *SQLStore) CheckForField(ctx context.Context, name string) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.CalculatedFields, 0)
		sess := dbSession.Table("calculatedfield")
		rawsql := "select t1.* from (" +
			"select cf.name  from calculatedfield cf " +
			"UNION ALL " +
			"select ccf.name  from custom_calculatedfields ccf" +
			") as t1 "
		rawsql += fmt.Sprintf(" WHERE t1.name = '%s'", name)
		if err := sess.SQL(rawsql).Find(&results); err != nil {
			return err
		}
		if len(results) > 0 {
			return models.DuplicateFieldName
		}
		return nil
	})
}

func (ss *SQLStore) ModifyCalcFields(ctx context.Context, cmd *models.ModifyCalcFieldCmd) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		modify := &models.ModifyCalcFieldCmd{
			OrgId:       cmd.OrgId,
			FormName:    cmd.FormName,
			Module:      cmd.Module,
			Name:        cmd.Name,
			SqlQuery:    cmd.SqlQuery,
			Aggregation: cmd.Aggregation,
		}
		sess := dbSession.Table("custom_calculatedfields")
		if _, err := sess.Table("custom_calculatedfields").
			Where("custom_calculatedfields.id = ?", cmd.Id).Update(modify); err != nil {
			return err
		}

		return nil
	})
}

func (ss *SQLStore) GetDashboardsToCalcUpdate(ctx context.Context, fieldName string, orgId int64, module string, sqlQuery string, name string) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.DashboardsToBeUpdatedDTO, 0)
		sess := dbSession.Table("dashboard")
		sess.Where("data LIKE ?", "%"+fieldName+"%").And("org_id = ?", orgId)
		sess.Cols("id", "data")
		err := sess.Find(&results)
		if err != nil {
			return err
		}
		for dIdx := range results {
			ss.UpdateDashboardWithNewCalc(ctx, results[dIdx].DashboardId, results[dIdx].DashboardData, module, sqlQuery, name)
		}
		return nil
	})
}

func (ss *SQLStore) UpdateDashboardWithNewCalc(ctx context.Context, dashId int64, dashboardData string, module string, sqlQuery string, fieldName string) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		source := simplejson.New()
		err := json.Unmarshal([]byte(dashboardData), &source)
		if err != nil {
			fmt.Println("Failed to unmarshall data to struct")
			return err
		}

		type CalculatedFieldValue struct {
			SelectionCalculatedFieldName string `json:"selectionCalculatedFieldName"`
			SelectionCalculatedFields    string `json:"selectionCalculatedFields"`
			SelectionQuery               string `json:"selectionQuery"`
		}

		updatedValues := CalculatedFieldValue{
			SelectionCalculatedFieldName: fieldName,
			SelectionCalculatedFields:    module + " -> " + fieldName,
			SelectionQuery:               sqlQuery,
		}

		panels := source.Get("panels").MustArray()
		for pIdx, panel := range panels {
			dataPanels := simplejson.NewFromAny(panel)
			targets := dataPanels.Get("targets").MustArray()
			for tIdx, target := range targets {
				data := simplejson.NewFromAny(target)
				calculatedFieldList := data.GetPath("sourceQuery", "form", "calculatedFieldList").MustArray()
				for cIdx, calculatedField := range calculatedFieldList {
					calculatedFieldValue := simplejson.NewFromAny(calculatedField)
					calculatedFieldValueName := calculatedFieldValue.Get("selectionCalculatedFieldName").MustString()
					if calculatedFieldValueName == fieldName {
						calculatedFieldValue.Set("selectionQuery", updatedValues.SelectionQuery)
						calculatedFieldValue.Set("selectionCalculatedFields", updatedValues.SelectionCalculatedFields)
						calculatedFieldList[cIdx] = calculatedFieldValue.Interface()
						break
					}
				}
				data.GetPath("sourceQuery", "form").Set("calculatedFieldList", calculatedFieldList)
				targets[tIdx] = data.Interface()
			}
			dataPanels.Set("targets", targets)
			panels[pIdx] = dataPanels.Interface()
		}
		source.Set("panels", panels)
		target, err := source.MarshalJSON()
		if err != nil {
			fmt.Println("Failed to marshall data to json")
			return err
		}
		updatedDashJson := string(target)

		updateCommand := models.DashboardUpdateCommand{
			DashboardData: updatedDashJson,
		}
		sess := dbSession.Table("dashboard")
		sess.Where("id = ?", dashId).Update(updateCommand)
		return nil
	})

}

func (ss *SQLStore) GetDashboardsToCalcDelete(ctx context.Context, cmd *models.DeleteCalcFieldsByIds) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		fieldNames := make([]*models.DashboardsToBeDeletedDTO, 0)
		sess := dbSession.Table("custom_calculatedfields")
		sess.Where("org_id = ?", cmd.OrgId)
		sess.In("id", cmd.Ids)
		sess.Cols("name")
		err := sess.Find(&fieldNames)
		if err != nil {
			return err
		}
		for cIdx := range fieldNames {
			results := make([]*models.DashboardsToBeUpdatedDTO, 0)
			sess1 := dbSession.Table("dashboard")
			sess1.Where("data LIKE ?", "%"+fieldNames[cIdx].FieldNames+"%").And("org_id = ?", cmd.OrgId)
			sess1.Cols("id", "data")
			err1 := sess1.Find(&results)
			if err1 != nil {
				return err1
			}
			if len(results) > 0 {
				for dIdx := range results {
					ss.UpdateDashboardRemoveCalc(ctx, results[dIdx].DashboardId, results[dIdx].DashboardData, fieldNames[cIdx].FieldNames)
				}
			}
		}
		return nil
	})

}
func (ss *SQLStore) UpdateDashboardRemoveCalc(ctx context.Context, dashId int64, dashboardData string, fieldName string) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		source := simplejson.New()
		err := json.Unmarshal([]byte(dashboardData), &source)
		if err != nil {
			fmt.Println("Failed to unmarshall data to struct")
			return err
		}

		type CalculatedFieldValue struct {
			HideCalculatedField          bool   `json:"hideCalculatedField"`
			SelectionAggregation         bool   `json:"selectionAggregation"`
			SelectionAlias               string `json:"selectionAlias"`
			SelectionCalculatedFieldName string `json:"selectionCalculatedFieldName"`
			SelectionCalculatedFields    string `json:"selectionCalculatedFields"`
			SelectionQuery               string `json:"selectionQuery"`
		}

		updatedValues := CalculatedFieldValue{
			HideCalculatedField:          true,
			SelectionAggregation:         false,
			SelectionAlias:               "CF",
			SelectionCalculatedFieldName: "",
			SelectionCalculatedFields:    "Select Calculated Field",
			SelectionQuery:               "Select Column Name",
		}

		panels := source.Get("panels").MustArray()
		for pIdx, panel := range panels {
			dataPanels := simplejson.NewFromAny(panel)
			targets := dataPanels.Get("targets").MustArray()
			for tIdx, target := range targets {
				data := simplejson.NewFromAny(target)
				calculatedFieldList := data.GetPath("sourceQuery", "form", "calculatedFieldList").MustArray()
				for cIdx, calculatedField := range calculatedFieldList {
					calculatedFieldValue := simplejson.NewFromAny(calculatedField)
					calculatedFieldValueName := calculatedFieldValue.Get("selectionCalculatedFieldName").MustString()
					if calculatedFieldValueName == fieldName {
						calculatedFieldValue.Set("selectionQuery", updatedValues.SelectionQuery)
						calculatedFieldValue.Set("selectionAlias", updatedValues.SelectionAlias)
						calculatedFieldValue.Set("selectionCalculatedFieldName", updatedValues.SelectionCalculatedFieldName)
						calculatedFieldValue.Set("selectionCalculatedFields", updatedValues.SelectionCalculatedFields)
						calculatedFieldValue.Set("selectionAggregation", updatedValues.SelectionAggregation)
						calculatedFieldValue.Set("hideCalculatedField", updatedValues.HideCalculatedField)
						calculatedFieldList[cIdx] = calculatedFieldValue.Interface()
						break
					}
				}
				data.GetPath("sourceQuery", "form").Set("calculatedFieldList", calculatedFieldList)
				targets[tIdx] = data.Interface()
			}
			dataPanels.Set("targets", targets)
			panels[pIdx] = dataPanels.Interface()
		}
		source.Set("panels", panels)
		target, err := source.MarshalJSON()
		if err != nil {
			fmt.Println("Failed to marshall data to json")
			return err
		}
		updatedDashJson := string(target)

		updateCommand := models.DashboardUpdateCommand{
			DashboardData: updatedDashJson,
		}
		sess := dbSession.Table("dashboard")
		sess.Where("id = ?", dashId).Update(updateCommand)
		return nil
	})

}
