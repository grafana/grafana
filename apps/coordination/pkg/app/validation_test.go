package app

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

func ptr[T any](v T) *T { return &v }

func leaseWith(spec coordinationv0alpha1.LeaseSpec) *coordinationv0alpha1.Lease {
	l := &coordinationv0alpha1.Lease{}
	l.Spec = spec
	return l
}

func TestValidateLease(t *testing.T) {
	tests := []struct {
		name    string
		action  resource.AdmissionAction
		obj     resource.Object
		oldObj  resource.Object
		wantErr bool
	}{
		{
			name:   "create with no duration is allowed",
			action: resource.AdmissionActionCreate,
			obj:    leaseWith(coordinationv0alpha1.LeaseSpec{HolderIdentity: ptr("a_1")}),
		},
		{
			name:   "duration at lower bound is allowed",
			action: resource.AdmissionActionCreate,
			obj:    leaseWith(coordinationv0alpha1.LeaseSpec{LeaseDurationSeconds: ptr[int32](10)}),
		},
		{
			name:   "duration at upper bound is allowed",
			action: resource.AdmissionActionCreate,
			obj:    leaseWith(coordinationv0alpha1.LeaseSpec{LeaseDurationSeconds: ptr[int32](600)}),
		},
		{
			name:    "duration below floor is rejected",
			action:  resource.AdmissionActionCreate,
			obj:     leaseWith(coordinationv0alpha1.LeaseSpec{LeaseDurationSeconds: ptr[int32](9)}),
			wantErr: true,
		},
		{
			name:    "duration above ceiling is rejected",
			action:  resource.AdmissionActionCreate,
			obj:     leaseWith(coordinationv0alpha1.LeaseSpec{LeaseDurationSeconds: ptr[int32](601)}),
			wantErr: true,
		},
		{
			name:   "renew-only update keeps the same holder",
			action: resource.AdmissionActionUpdate,
			oldObj: leaseWith(coordinationv0alpha1.LeaseSpec{HolderIdentity: ptr("a_1"), RenewTime: ptr("t1")}),
			obj:    leaseWith(coordinationv0alpha1.LeaseSpec{HolderIdentity: ptr("a_1"), RenewTime: ptr("t2")}),
		},
		{
			name:   "takeover advances renewTime",
			action: resource.AdmissionActionUpdate,
			oldObj: leaseWith(coordinationv0alpha1.LeaseSpec{HolderIdentity: ptr("a_1"), RenewTime: ptr("t1")}),
			obj:    leaseWith(coordinationv0alpha1.LeaseSpec{HolderIdentity: ptr("b_2"), RenewTime: ptr("t2")}),
		},
		{
			name:    "takeover without advancing renewTime is rejected",
			action:  resource.AdmissionActionUpdate,
			oldObj:  leaseWith(coordinationv0alpha1.LeaseSpec{HolderIdentity: ptr("a_1"), RenewTime: ptr("t1")}),
			obj:     leaseWith(coordinationv0alpha1.LeaseSpec{HolderIdentity: ptr("b_2"), RenewTime: ptr("t1")}),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateLease(context.Background(), &app.AdmissionRequest{
				Action:    tt.action,
				Object:    tt.obj,
				OldObject: tt.oldObj,
			})
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
