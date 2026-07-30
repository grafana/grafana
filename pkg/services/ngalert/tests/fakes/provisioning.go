package fakes

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeProvisioningStore struct {
	Calls                          []Call
	Records                        map[int64]map[string]models.Provenance
	GetProvenanceFunc              func(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenancesFunc             func(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error)
	GetProvenancesByUIDsFunc       func(ctx context.Context, orgID int64, resourceType string, uids []string) (map[string]models.Provenance, error)
	SetProvenanceFunc              func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenanceFunc           func(ctx context.Context, o models.Provisionable, org int64) error
	GetManagerPropertiesFunc       func(ctx context.Context, o models.Provisionable, org int64) (utils.ManagerProperties, error)
	GetManagerPropertiesByUIDsFunc func(ctx context.Context, org int64, resourceType string, uids []string) (map[string]utils.ManagerProperties, error)
	SetManagerPropertiesFunc       func(ctx context.Context, o models.Provisionable, org int64, m utils.ManagerProperties) error
}

func NewFakeProvisioningStore() *FakeProvisioningStore {
	return &FakeProvisioningStore{
		Records: map[int64]map[string]models.Provenance{},
	}
}

func (f *FakeProvisioningStore) GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetProvenance", Arguments: []any{ctx, o, org}})
	if f.GetProvenanceFunc != nil {
		return f.GetProvenanceFunc(ctx, o, org)
	}
	if val, ok := f.Records[org]; ok {
		if prov, ok := val[o.ResourceID()+o.ResourceType()]; ok {
			return prov, nil
		}
	}
	return models.ProvenanceNone, nil
}

func (f *FakeProvisioningStore) GetProvenances(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetProvenances", Arguments: []any{ctx, orgID, resourceType}})
	if f.GetProvenancesFunc != nil {
		return f.GetProvenancesFunc(ctx, orgID, resourceType)
	}
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

func (f *FakeProvisioningStore) GetProvenancesByUIDs(ctx context.Context, orgID int64, resourceType string, uids []string) (map[string]models.Provenance, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetProvenancesByUIDs", Arguments: []any{ctx, orgID, resourceType, uids}})
	if f.GetProvenancesByUIDsFunc != nil {
		return f.GetProvenancesByUIDsFunc(ctx, orgID, resourceType, uids)
	}
	results := make(map[string]models.Provenance)
	if val, ok := f.Records[orgID]; ok {
		for _, uid := range uids {
			key := uid + resourceType
			if prov, ok := val[key]; ok {
				results[uid] = prov
			}
		}
	}
	return results, nil
}

func (f *FakeProvisioningStore) SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error {
	f.Calls = append(f.Calls, Call{MethodName: "SetProvenance", Arguments: []any{ctx, o, org, p}})
	if f.SetProvenanceFunc != nil {
		return f.SetProvenanceFunc(ctx, o, org, p)
	}
	if _, ok := f.Records[org]; !ok {
		f.Records[org] = map[string]models.Provenance{}
	}
	if val, ok := f.Records[org]; ok {
		delete(val, o.ResourceID()+o.ResourceType())
	}
	f.Records[org][o.ResourceID()+o.ResourceType()] = p
	return nil
}

func (f *FakeProvisioningStore) DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error {
	f.Calls = append(f.Calls, Call{MethodName: "DeleteProvenance", Arguments: []any{ctx, o, org}})
	if f.DeleteProvenanceFunc != nil {
		return f.DeleteProvenanceFunc(ctx, o, org)
	}
	if val, ok := f.Records[org]; ok {
		delete(val, o.ResourceID()+o.ResourceType())
	}
	return nil
}

func (f *FakeProvisioningStore) GetManagerProperties(ctx context.Context, o models.Provisionable, org int64) (utils.ManagerProperties, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetManagerProperties", Arguments: []any{ctx, o, org}})
	if f.GetManagerPropertiesFunc != nil {
		return f.GetManagerPropertiesFunc(ctx, o, org)
	}
	// Derive from stored provenance for backwards compat with tests that only set provenance.
	if val, ok := f.Records[org]; ok {
		if prov, ok := val[o.ResourceID()+o.ResourceType()]; ok {
			return models.ProvenanceToManagerProperties(prov), nil
		}
	}
	return utils.ManagerProperties{}, nil
}

func (f *FakeProvisioningStore) GetManagerPropertiesByUIDs(ctx context.Context, org int64, resourceType string, uids []string) (map[string]utils.ManagerProperties, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetManagerPropertiesByUIDs", Arguments: []any{ctx, org, resourceType, uids}})
	if f.GetManagerPropertiesByUIDsFunc != nil {
		return f.GetManagerPropertiesByUIDsFunc(ctx, org, resourceType, uids)
	}
	result := make(map[string]utils.ManagerProperties)
	if val, ok := f.Records[org]; ok {
		for _, uid := range uids {
			key := uid + resourceType
			if prov, ok := val[key]; ok {
				result[uid] = models.ProvenanceToManagerProperties(prov)
			}
		}
	}
	return result, nil
}

func (f *FakeProvisioningStore) SetManagerProperties(ctx context.Context, o models.Provisionable, org int64, m utils.ManagerProperties) error {
	f.Calls = append(f.Calls, Call{MethodName: "SetManagerProperties", Arguments: []any{ctx, o, org, m}})
	if f.SetManagerPropertiesFunc != nil {
		return f.SetManagerPropertiesFunc(ctx, o, org, m)
	}
	// Store the derived provenance so existing provenance-based tests still work.
	if _, ok := f.Records[org]; !ok {
		f.Records[org] = map[string]models.Provenance{}
	}
	f.Records[org][o.ResourceID()+o.ResourceType()] = models.ManagerPropertiesToProvenance(m)
	return nil
}
