package fakes

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeProvisioningStore struct {
	Records map[int64]map[string]models.Provenance
}

func NewFakeProvisioningStore() *FakeProvisioningStore {
	return &FakeProvisioningStore{
		Records: map[int64]map[string]models.Provenance{},
	}
}

func (f *FakeProvisioningStore) GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
	if val, ok := f.Records[org]; ok {
		if prov, ok := val[o.ResourceID()+o.ResourceType()]; ok {
			return prov, nil
		}
	}
	return models.ProvenanceNone, nil
}

func (f *FakeProvisioningStore) GetProvenances(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error) {
	results := make(map[string]models.Provenance)
	if val, ok := f.Records[orgID]; ok {
		for k, v := range val {
			if strings.HasSuffix(k, resourceType) {
				results[strings.TrimSuffix(k, resourceType)] = v
			}
		}
	}
	return results, nil
}

func (f *FakeProvisioningStore) SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error {
	if _, ok := f.Records[org]; !ok {
		f.Records[org] = map[string]models.Provenance{}
	}
	_ = f.DeleteProvenance(ctx, o, org) // delete old entries first
	f.Records[org][o.ResourceID()+o.ResourceType()] = p
	return nil
}

func (f *FakeProvisioningStore) DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error {
	if val, ok := f.Records[org]; ok {
		delete(val, o.ResourceID()+o.ResourceType())
	}
	return nil
}
