package rest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/zeebo/assert"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"
	"k8s.io/apiserver/pkg/registry/rest"
)

const kind = "dummy"

func TestMode1(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode1(lsSpy, sSpy)

	// Create: it should use the Legacy Create implementation
	_, err := dw.Create(context.Background(), &dummyObject{}, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Create"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Create"))

	// Get: it should use the Legacy Get implementation
	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))

	// List: it should use the Legacy List implementation
	_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 0, sSpy.Counts("Storage.List"))

	// Delete: it should use the Legacy Delete implementation
	var deleteValidation = func(ctx context.Context, obj runtime.Object) error { return nil }
	_, _, err = dw.Delete(context.Background(), kind, deleteValidation, &metav1.DeleteOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Delete"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Delete"))

	// DeleteCollection: it should use the Legacy DeleteCollection implementation
	_, err = dw.DeleteCollection(
		context.Background(),
		func(context.Context, runtime.Object) error { return nil },
		&metav1.DeleteOptions{},
		&metainternalversion.ListOptions{},
	)
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.DeleteCollection"))
	assert.Equal(t, 0, sSpy.Counts("Storage.DeleteCollection"))
type legacyStoreMock struct {
	*mock.Mock
	LegacyStorage
}

type unifiedStoreMock struct {
	*mock.Mock
	Storage
}

func (m *legacyStoreMock) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	args := m.Called(ctx, name, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m *legacyStoreMock) Create(ctx context.Context, name string, options *metav1.GetOptions) (bool, error) {
	args := m.Called(ctx, name, options)
	return args.Bool(0), args.Error(1)
}

func (m *legacyStoreMock) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m *legacyStoreMock) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

// func (m LegacyStoreMock) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
// 	args := m.Called(ctx, object, tableOptions)
// 	return args.Get(0).(*metav1.Table), args.Error(1)
// }

// Unified Store
func (m *unifiedStoreMock) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	args := m.Called(ctx, name, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m *unifiedStoreMock) Create(ctx context.Context, name string, options *metav1.GetOptions) (bool, error) {
	args := m.Called(ctx, name, options)
	return args.Bool(0), args.Error(1)
}

func (m *unifiedStoreMock) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m *unifiedStoreMock) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func TestMode1_Create(t *testing.T) {
	type testCase struct {
		name          string
		setupLegacyFn func(m *mock.Mock)
		setupUSFn     func(ctx context.Context, name string, options *metav1.GetOptions)
		wantErr       bool
	}
	tests :=
		[]testCase{
			{
				name: "creating an object only in the legacy store",
				setupLegacyFn: func(m *mock.Mock) {
					m.On("Create").Return(&example.Pod{TypeMeta: metav1.TypeMeta{}, ObjectMeta: metav1.ObjectMeta{Name: "foo"}, Spec: example.PodSpec{}, Status: example.PodStatus{}}, nil)
				},
			},
		}

	for _, tt := range tests {
		// lg := LegacyStorage{rest.Creater}
		m := &mock.Mock{}
		ls := legacyStoreMock{m}
		us := unifiedStoreMock{m}
		if tt.setupLegacyFn != nil {
			// m.On("Create", tt.setupLegacyFn)
		}
		// if tt.setupUSFn != nil {
		// 	s.UnifiedStoreMock = us
		// }

		dw := SelectDualWriter(Mode1, ls, us)

		obj, err := dw.Create(context.Background(), &example.Pod{metav1.ObjectMeta: v1.ObjectMeta{Name: "foo"}}, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})

		assert.NoError(t, err)

	}
	// var ls = (LegacyStorage)(nil)
	// var s = (Storage)(nil)
	// lsSpy := NewLegacyStorageSpyClient(ls)
	// sSpy := NewStorageSpyClient(s)

	// dw := NewDualWriterMode1(lsSpy, sSpy)

	// // Create: it should use the Legacy Create implementation
	// _, err := dw.Create(context.Background(), &dummyObject{}, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	// assert.NoError(t, err)
	// assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Create"))
	// assert.Equal(t, 0, sSpy.Counts("Storage.Create"))

	// // Get: it should use the Legacy Get implementation
	// _, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	// assert.NoError(t, err)
	// assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Get"))
	// assert.Equal(t, 0, sSpy.Counts("Storage.Get"))

	// // List: it should use the Legacy List implementation
	// _, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
	// assert.NoError(t, err)
	// assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.List"))
	// assert.Equal(t, 0, sSpy.Counts("Storage.List"))

	// // Delete: it should use the Legacy Delete implementation
	// var deleteValidation = func(ctx context.Context, obj runtime.Object) error { return nil }
	// _, _, err = dw.Delete(context.Background(), kind, deleteValidation, &metav1.DeleteOptions{})
	// assert.NoError(t, err)
	// assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Delete"))
	// assert.Equal(t, 0, sSpy.Counts("Storage.Delete"))
}
