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
	Register() error
	ScheduleNext() error
	Unregister() error
	GetActiveNodesCount(ts uint64) (int, error)
	GetNodeId() (string, error)
	GetNodeSequence() (int32, error)
}

type ClusterNode struct {
	nodeId string
	log    log.Logger
}

var (
	clusterNodeMgmt ClusterNodeMgmt
)

func getCurrentNodeId() string {
	if setting.InstanceName == "" || setting.HttpPort == "" {
		return ""
	}
	return fmt.Sprintf("%v:%v", setting.InstanceName, setting.HttpPort)
}
func InitClusterNode() {
	node := &ClusterNode{
		nodeId: getCurrentNodeId(),
		log:    log.New("alerting.clusterNode"),
	}
	clusterNodeMgmt = node
}

func (node *ClusterNode) Register() error {
	if node == nil {
		return errors.New("Cluster node object is nil")
	}
	cmd := &m.SaveActiveNodeCommand{}
	cmd.ActiveNode = make([]*m.ActiveNode, 1)
	cmd.ActiveNode[0] = &m.ActiveNode{NodeId: node.nodeId}
	if err := bus.Dispatch(cmd); err != nil {
		er := fmt.Errorf("Failed to register node - %v", node.nodeId)
		node.log.Error(er.Error())
		return er
	}
	return nil
}

func (node *ClusterNode) Unregister() error {
	if node == nil {
		return errors.New("Cluster node object is nil")
	}
	return errors.New("Not implemented")
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

func (node *ClusterNode) ScheduleNext() error {
	if node == nil {
		return errors.New("Cluster node object is nil")
	}
	return errors.New("Not implemented")
}

func (node *ClusterNode) GetNodeSequence() (int32, error) {
	if(node == nil) {
		return errors.New("Cluster node object is nil")
	}
	// get node sequence number from db
}
