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

func InsertActiveNode(cmd *m.SaveActiveNodeCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		for _, ac := range cmd.ActiveNode {
			_, err := sess.Insert(ac)
			if err != nil {
				return err
			}
			sqlog.Debug("Active node inserted", "id", ac.Id)
		}
		return nil
	})
}
