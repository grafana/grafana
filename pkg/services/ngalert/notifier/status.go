package notifier

import (
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/cluster"
)

func (am *Alertmanager) GetStatus() apimodels.GettableStatus {
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()

	config := apimodels.PostableApiAlertingConfig{}
	if am.ready() {
		config = am.config.AlertmanagerConfig
	}
	cs := amv2.ClusterStatusStatusDisabled
	clusterStatus := &amv2.ClusterStatus{
		Status: &cs,
		Peers:  []*amv2.PeerStatus{},
	}
	p, ok := am.peer.(*cluster.Peer)
	if ok {
		for _, peer := range p.Peers() {
			name, address := peer.Name(), peer.Address()
			clusterStatus.Peers = append(clusterStatus.Peers, &amv2.PeerStatus{
				Name:    &name,
				Address: &address,
			})
		}
		status := p.Status()
		clusterStatus.Status = &status
	}
	return *apimodels.NewGettableStatus(&config, clusterStatus)
}
