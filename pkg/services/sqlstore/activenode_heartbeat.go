package sqlstore

import (
	"bytes"
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetActiveNodeById)
	bus.AddHandler("sql", InsertActiveNode)
	bus.AddHandler("sql", InsertNodeProcessingMissingAlerts)
	bus.AddHandler("sql", GetNode)
}

func GetActiveNodeById(query *m.GetActiveNodeByIDQuery) error {
	activeNode := m.ActiveNodeHeartbeat{}
	has, err := x.Id(query.Id).Get(&activeNode)
	if !has {
		return fmt.Errorf("Could not find active node record")
	}
	if err != nil {
		return err
	}
	query.Result = &activeNode
	return nil
}

func InsertActiveNode(cmd *m.SaveActiveNodeCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		ac := cmd.Result
		_, err := sess.Insert(ac)
		if err != nil {
			return err
		}
		sqlog.Debug("Active node inserted", "id", ac.Id)
		return nil
	})
}

func InsertNodeProcessingMissingAlerts(heartbeartCmd *m.GetHeartBeatCmd, saveNodeCmd *m.SaveNodeByAlertTypeCmd) error {
	return inTransaction(func(sess *xorm.Session) error {
		heartbeatSql := fmt.Sprintf("select %s", dialect.CurrentTimeToRoundMinSql())
		if err1 := sess.Sql(heartbeatSql).Find(&heartbeartCmd.RoundedHeartbeat); err1 != nil {
			return err1
		}

		activeNode := *m.ActiveNodeHeartbeat{
			NodeId:       saveNodeCmd.NodeId,
			PartitionNo:  saveNodeCmd.PartitionNo,
			AlertRunType: saveNodeCmd.AlertRunType,
			Heartbeat:    *heartbeartCmd.RoundedHeartbeat,
		}

		if _, err2 = sess.Insert(&activeNode); err != nil {
			return err2
		}
		saveNodeCmd.Result = activeNode
		return nil
	})
}

func GetNode(query *m.GetNodeByAlertTypeAndHeartbeatCmd) error {
	return inTransaction(func(sess *xorm.Session) error {
		var sql bytes.Buffer
		params := make([]interface{}, 0)

		sql.WriteString(`SELECT *
						from activenode_heartbeat
						`)

		sql.WriteString(`WHERE alert_run_type = ?`)
		params = append(params, query.AlertRunType)

		if query.HeartBeat != 0 {
			sql.WriteString(` AND heartbeat = ?`)
			params = append(params, query.HeartBeat)
		}

		sql.WriteString(` AND partition_no = ?`)
		params = append(params, query.PartitionNo)

		if err := x.Sql(sql.String(), params...).Find(&query.Result); err != nil {
			return err
		}
		return nil
	})
}
