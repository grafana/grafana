package clustering

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type ClusterNodeMgmt interface {
	CheckIn() error
	GetActiveNodesCount(ts uint64) (int, error)
	GetNodeId() (string, error)
	GetNodeSequence() (int32, error)
}

type ClusterNode struct {
	nodeId string
	log    log.Logger
}

var (
	clusterNodeMgmt ClusterNodeMgmt = nil
)

func getCurrentNodeId() string {
	if setting.InstanceName == "" || setting.HttpPort == "" {
		panic("InstanceName or HttpPort is empty. Check your configuration.")
	}
	return fmt.Sprintf("%v:%v", setting.InstanceName, setting.HttpPort)
}

func getClusterNode() ClusterNodeMgmt {
	if clusterNodeMgmt != nil {
		return clusterNodeMgmt
	}
	node := &ClusterNode{
		nodeId: getCurrentNodeId(),
		log:    log.New("clustering.clusterNode"),
	}
	clusterNodeMgmt = node
	return node

}

func (node *ClusterNode) CheckIn() error {
	if node == nil {
		return errors.New("Cluster node object is nil")
	}
	cmd := &m.SaveActiveNodeCommand{}
	cmd.Node = &m.ActiveNode{NodeId: node.nodeId, AlertRunType: "Normal"}
	node.log.Debug("Sending command ", "SaveActiveNodeCommand:Node", cmd.Node)
	if err := bus.Dispatch(cmd); err != nil {

		errmsg := fmt.Sprintf("Failed to save heartbeat - node %v", cmd.Node)
		node.log.Error(errmsg, "error", err)
		return err
	}
	node.log.Debug("Command executed successfully")
	return nil
}

func (node *ClusterNode) GetActiveNodesCount(ts uint64) (int, error) {
	if node == nil {
		return 0, errors.New("Cluster node object is nil")
	}
	return 0, errors.New("Not implemented")
}

func (node *ClusterNode) GetNodeId() (string, error) {
	if node == nil {
		return "", errors.New("Cluster node object is nil")
	}
	return node.nodeId, nil
}

func (node *ClusterNode) GetNodeSequence() (int32, error) {
	if node == nil {
		return 0, errors.New("Cluster node object is nil")
	}
	// get node sequence number from db
	return 0, errors.New("Not implemented")
}
