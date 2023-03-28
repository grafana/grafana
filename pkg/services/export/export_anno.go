package export

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/infra/db"
)

func exportAnnotations(helper *commitHelper, job *gitExportJob) error {
	return job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type annoResult struct {
			ID          int64  `xorm:"id"`
			DashboardID int64  `xorm:"dashboard_id"`
			PanelID     int64  `xorm:"panel_id"`
			UserID      int64  `xorm:"user_id"`
			Text        string `xorm:"text"`
			Epoch       int64  `xorm:"epoch"`
			EpochEnd    int64  `xorm:"epoch_end"`
			Created     int64  `xorm:"created"` // not used
			Tags        string `xorm:"tags"`    // JSON Array
		}

		type annoEvent struct {
			PanelID  int64  `json:"panel"`
			Text     string `json:"text"`
			Epoch    int64  `json:"epoch"` // dashboard/start+end is really the UID
			EpochEnd int64  `json:"epoch_end,omitempty"`
			Tags     []string
		}

		rows := make([]*annoResult, 0)

		sess.Table("annotation").
			Where("org_id = ? AND alert_id = 0", helper.orgID).Asc("epoch")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		count := len(rows)
		f_ID := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
		f_DashboardID := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
		f_PanelID := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
		f_Epoch := data.NewFieldFromFieldType(data.FieldTypeTime, count)
		f_EpochEnd := data.NewFieldFromFieldType(data.FieldTypeNullableTime, count)
		f_Text := data.NewFieldFromFieldType(data.FieldTypeString, count)
		f_Tags := data.NewFieldFromFieldType(data.FieldTypeJSON, count)

		f_ID.Name = "ID"
		f_DashboardID.Name = "DashboardID"
		f_PanelID.Name = "PanelID"
		f_Epoch.Name = "Epoch"
		f_EpochEnd.Name = "EpochEnd"
		f_Text.Name = "Text"
		f_Tags.Name = "Tags"

		for id, row := range rows {
			f_ID.Set(id, row.ID)
			f_DashboardID.Set(id, row.DashboardID)
			f_PanelID.Set(id, row.PanelID)
			f_Epoch.Set(id, time.UnixMilli(row.Epoch))
			if row.Epoch != row.EpochEnd {
				f_EpochEnd.SetConcrete(id, time.UnixMilli(row.EpochEnd))
			}
			f_Text.Set(id, row.Text)
			f_Tags.Set(id, json.RawMessage(row.Tags))

			// Save a file for each
			event := &annoEvent{
				PanelID: row.PanelID,
				Text:    row.Text,
			}
			err = json.Unmarshal([]byte(row.Tags), &event.Tags)
			if err != nil {
				return err
			}
			fname := fmt.Sprintf("%d", row.Epoch)
			if row.Epoch != row.EpochEnd {
				fname += "-" + fmt.Sprintf("%d", row.EpochEnd)
			}

			err = helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: filepath.Join(helper.orgDir,
							"annotations",
							"dashboard",
							fmt.Sprintf("id-%d", row.DashboardID),
							fname+".json"),
						body: prettyJSON(event),
					},
				},
				when:    time.UnixMilli(row.Epoch),
				comment: fmt.Sprintf("Added annotation (%d)", row.ID),
				userID:  row.UserID,
			})
			if err != nil {
				return err
			}
		}

		if f_ID.Len() > 0 {
			frame := data.NewFrame("", f_ID, f_DashboardID, f_PanelID, f_Epoch, f_EpochEnd, f_Text, f_Tags)
			js, err := jsoniter.ConfigCompatibleWithStandardLibrary.MarshalIndent(frame, "", "  ")
			if err != nil {
				return err
			}

			err = helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: filepath.Join(helper.orgDir, "annotations", "annotations.json"),
						body:  js, // TODO, pretty?
					},
				},
				when:    time.Now(),
				comment: "Exported annotations",
			})
			if err != nil {
				return err
			}
		}
		return err
	})
}
