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
	query.Result = []*m.ActiveNodeHeartbeat{
		&activeNode,
	}
	return nil
}

func InsertActiveNode(cmd *m.SaveActiveNodeCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		ac := cmd.ActiveNodeHeartbeat
		_, err := sess.Insert(ac)
		if err != nil {
			return err
		}
		sqlog.Debug("Active node inserted", "id", ac.Id)

		return nil
	})
}

func InsertNodeProcessingMissingAlerts(cmd *m.SaveNodeProcessingMissingAlertCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		activeNode := &m.ActiveNodeHeartbeat{
			NodeId:       cmd.NodeId,
			Heartbeat:    cmd.Heartbeat, //Need to get one minute precision heartbeat
			PartitionNo:  0,
			AlertRunType: m.MISSING_ALERT,
		}
		_, err := sess.Insert(activeNode)

		if err != nil {
			return err
		}
		cmd.Result = activeNode
		return nil
	})
}

func GetNodeByAlertRunType() error {
	activeNode := m.ActiveNode{}
	has, err := x.Id(query.Id).Get(&activeNode)
	if !has {
		return fmt.Errorf("Could not find active node record")
	}
	if err != nil {
		return err
	}
	query.Result = []*m.ActiveNode{
		&activeNode,
	}
	return nil
}
