package sqlstore

import (
	"errors"
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

var (
	insertHeartbeatSQL = "insert into active_node(node_id, heartbeat, \"partitionNo\", \"alertRunType\") values(?, ?, (select count(\"partitionNo\") from active_node where \"heartbeat\" >= ?) + 1, ?)"
)

func init() {
	bus.AddHandler("sql", GetActiveNodeById)
	bus.AddHandler("sql", InsertActiveNodeHeartbeat)
	bus.AddHandler("sql", InsertNodeProcessingMissingAlert)
}

func GetActiveNodeById(query *m.GetActiveNodeByIDQuery) error {
	activeNode := m.ActiveNode{}
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

func InsertActiveNodeHeartbeat(cmd *m.SaveActiveNodeCommand) error {
	sqlog.Debug(fmt.Sprintf("Received command %v", cmd))
	if cmd.Node == nil {
		return errors.New("No ActiveNode found to save")
	}

	return inTransaction(func(sess *xorm.Session) error {

		result := struct{ Ts int64 }{}
		_, err := sess.Select(dialect.CurrentTimeToRoundMinSql() + "as ts").Cols("ts").Get(&result)
		if err != nil {
			sqlog.Error("Failed to get timestamp", "error", err)
			return err
		}
		ts := result.Ts
		_, err = sess.Exec(insertHeartbeatSQL, cmd.Node.NodeId, ts, ts, cmd.Node.AlertRunType)
		if err != nil {
			sqlog.Error("Failed to insert heartbeat", "error", err)
			return err
		}
		var retNode m.ActiveNode
		has, err := sess.Where("heartbeat=?", ts).And("node_id=?", cmd.Node.NodeId).Get(&retNode)
		if err != nil {
			sqlog.Error("Failed to get inserted record", "error", err)
			return err
		}
		if !has {
			return errors.New("Unable to read inserted heartbeat record")
		}
		cmd.Result = &retNode
		sqlog.Debug("Active node heartbeat inserted", "id", cmd.Node.Id)
		return nil
	})
}

func InsertNodeProcessingMissingAlert(cmd *m.SaveNodeProcessingMissingAlertCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		result := struct{ Ts int64 }{}
		_, err := sess.Select(dialect.CurrentTimeToRoundMinSql() + "as ts").Cols("ts").Get(&result)
		if err != nil {
			sqlog.Error("Failed to get timestamp", "error", err)
			return err
		}
		nodeProcessingMissingAlert := &m.ActiveNode{
			NodeId:       cmd.Node.NodeId,
			PartitionNo:  0,
			AlertRunType: m.MISSING_ALERT,
			Heartbeat:    result.Ts,
		}
		if _, err = sess.Insert(nodeProcessingMissingAlert); err != nil {
			return err
		}
		cmd.Result = nodeProcessingMissingAlert
		return nil
	})
}
