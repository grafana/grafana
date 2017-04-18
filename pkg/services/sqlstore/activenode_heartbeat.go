package sqlstore

import (
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetActiveNodeById)
	bus.AddHandler("sql", InsertActiveNode)
	bus.AddHandler("sql", InsertNodeProcessingMissingAlerts)
	bus.AddHandler("sql", GetNodeProcessingMissingAlert)
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

func InsertNodeProcessingMissingAlerts(cmd *m.SaveNodeByIdCmd) error {
	return inTransaction(func(sess *xorm.Session) error {
		sql := fmt.Sprintf("Insert into active_node_heartbeat(node_id,heartbeat,partition_no,alert_run_type) values ('%s',%s,%d,'%s')", cmd.NodeId, dialect.CurrentTimeToRoundMinSql(), 0, m.MISSING_ALERT)
		//sqlog.Info("Query to insert node processing missing alerts : " + sql)
		fmt.Println("Query format to insert node processing missing alerts : " + sql)
		_, err := sess.Exec(sql)

		if err != nil {
			return err
		}
		fmt.Println("Successfully inserted missing node")
		return nil
	})
}

func GetNodeProcessingMissingAlert(query *m.GetNodeProcessingMissingAlertQuery) error {
	return inTransaction(func(sess *xorm.Session) error {
		sql := fmt.Sprintf("select * from active_node_heartbeat where heartbeat=%s and partition_no=%d and alert_run_type='%s'",
			dialect.CurrentTimeToRoundMinSql(), 0,
			m.MISSING_ALERT)
		fmt.Println("Query to get node processing missing alerts : " + sql)
		if err := sess.Sql(sql).Find(&query.Result); err != nil {
			return err
		}
		fmt.Println("sucessfully executed get query....")
		return nil
	})
}
