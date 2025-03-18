package rest

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/apis/example"
	"k8s.io/apiserver/pkg/endpoints/request"
)

var legacyObj1 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo1", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}
var legacyObj2 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo2", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}
var legacyObj3 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo3", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}
var legacyObj4 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo4", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}

var legacyObj2WithHostname = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo2", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{Hostname: "hostname"}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}

var storageObj1 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo1", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}
var storageObj2 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo2", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}
var storageObj3 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo3", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}
var storageObj4 = &example.Pod{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ObjectMeta: metav1.ObjectMeta{Name: "foo4", ResourceVersion: "1", CreationTimestamp: metav1.Time{}}, Spec: example.PodSpec{}, Status: example.PodStatus{StartTime: &metav1.Time{Time: time.Now()}}}

var legacyListWith3items = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{},
	Items: []example.Pod{
		*legacyObj1,
		*legacyObj2,
		*legacyObj3,
	}}

var legacyListWith4items = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{},
	Items: []example.Pod{
		*legacyObj1,
		*legacyObj2,
		*legacyObj3,
		*legacyObj4,
	}}

var legacyListWith3itemsObj2IsDifferent = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{},
	Items: []example.Pod{
		*legacyObj1,
		*legacyObj2WithHostname,
		*legacyObj3,
	}}

var storageListWith3items = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{},
	Items: []example.Pod{
		*storageObj1,
		*storageObj2,
		*storageObj3,
	}}

var storageListWith4items = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{},
	Items: []example.Pod{
		*storageObj1,
		*storageObj2,
		*storageObj3,
		*storageObj4,
	}}

var storageListWith3itemsMissingFoo2 = &example.PodList{TypeMeta: metav1.TypeMeta{Kind: "foo"}, ListMeta: metav1.ListMeta{},
	Items: []example.Pod{
		*storageObj1,
		*storageObj3,
		*storageObj4,
	}}

func TestLegacyToUnifiedStorage_DataSyncer(t *testing.T) {
	type testCase struct {
		setupLegacyFn   func(m *mock.Mock)
		setupStorageFn  func(m *mock.Mock)
		name            string
		expectedOutcome bool
		wantErr         bool
	}
	tests :=
		[]testCase{
			{
				name: "both stores are in sync",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith3items, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith3items, nil)
				},
				expectedOutcome: true,
			},
			{
				name: "both stores are in sync - fail to list from legacy",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith3items, errors.New("error"))
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith3items, nil)
				},
				expectedOutcome: false,
			},
			{
				name: "both stores are in sync - fail to list from storage",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith3items, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith3items, errors.New("error"))
				},
				expectedOutcome: false,
			},
			{
				name: "storage is missing 1 entry (foo4)",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith4items, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith3items, nil)
					m.On("Update", mock.Anything, "foo4", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				expectedOutcome: true,
			},
			{
				name: "storage needs to be update (foo2 is different)",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith3itemsObj2IsDifferent, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith3items, nil)
					m.On("Update", mock.Anything, "foo2", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				expectedOutcome: true,
			},
			{
				name: "storage is missing 1 entry (foo4) - fail to upsert",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith4items, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith3items, nil)
					m.On("Update", mock.Anything, "foo4", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, errors.New("error"))
				},
				expectedOutcome: false,
			},
			{
				name: "storage has an extra 1 entry (foo4)",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith3items, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith4items, nil)
					m.On("Delete", mock.Anything, "foo4", mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				expectedOutcome: true,
			},
			{
				name: "storage has an extra 1 entry (foo4) - fail to delete",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith3items, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith4items, nil)
					m.On("Delete", mock.Anything, "foo4", mock.Anything, mock.Anything).Return(exampleObj, false, errors.New("error"))
				},
				expectedOutcome: false,
			},
			{
				name: "storage is missing 1 entry (foo3) and has an extra 1 entry (foo4)",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(legacyListWith3items, nil)
				},
				setupStorageFn: func(m *mock.Mock) {
					m.On("List", mock.Anything, mock.Anything).Return(storageListWith3itemsMissingFoo2, nil)
					m.On("Update", mock.Anything, "foo2", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(exampleObj, false, nil)
					m.On("Delete", mock.Anything, "foo4", mock.Anything, mock.Anything).Return(exampleObj, false, nil)
				},
				expectedOutcome: true,
			},
		}

	// mode 1
	for _, tt := range tests {
		t.Run("Mode-1-"+tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			lm := &mock.Mock{}
			um := &mock.Mock{}

			ls := legacyStoreMock{lm, l}
			us := storageMock{um, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(lm)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(um)
			}

			outcome, err := legacyToUnifiedStorageDataSyncer(context.Background(), &SyncerConfig{
				Mode:              Mode1,
				LegacyStorage:     ls,
				Storage:           us,
				Kind:              "test.kind",
				Reg:               p,
				ServerLockService: &fakeServerLock{},
				RequestInfo:       &request.RequestInfo{},

				DataSyncerRecordsLimit: 1000,
				DataSyncerInterval:     time.Hour,
			})
			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedOutcome, outcome)
		})
	}

	// mode 2
	for _, tt := range tests {
		t.Run("Mode-2-"+tt.name, func(t *testing.T) {
			l := (LegacyStorage)(nil)
			s := (Storage)(nil)
			lm := &mock.Mock{}
			um := &mock.Mock{}

			ls := legacyStoreMock{lm, l}
			us := storageMock{um, s}

			if tt.setupLegacyFn != nil {
				tt.setupLegacyFn(lm)
			}
			if tt.setupStorageFn != nil {
				tt.setupStorageFn(um)
			}

			outcome, err := legacyToUnifiedStorageDataSyncer(context.Background(), &SyncerConfig{
				Mode:              Mode2,
				LegacyStorage:     ls,
				Storage:           us,
				Kind:              "test.kind",
				Reg:               p,
				ServerLockService: &fakeServerLock{},
				RequestInfo:       &request.RequestInfo{},

				DataSyncerRecordsLimit: 1000,
				DataSyncerInterval:     time.Hour,
			})
			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedOutcome, outcome)
		})
	}
}
