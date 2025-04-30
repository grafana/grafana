package simulator

import (
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/fakes"
)

type SimKeeperService struct {
	systemKeeper *fakes.FakeKeeper
}

func NewSimKeeperService() *SimKeeperService {
	return &SimKeeperService{
		systemKeeper: fakes.NewFakeKeeper(),
	}
}

func (k *SimKeeperService) KeeperForConfig(secretv0alpha1.KeeperConfig) (contracts.Keeper, error) {
	return k.systemKeeper, nil
}
