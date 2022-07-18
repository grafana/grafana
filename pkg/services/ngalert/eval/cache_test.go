package eval

import (
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestLastSeenDatasourceCache_GetDatasource(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	ctx := context.Background()
	user := models.SignedInUser{OrgId: 1}

	expected1 := datasources.DataSource{Id: 2, OrgId: 1, Version: 1, Uid: "foo"}
	expected2 := datasources.DataSource{Id: 2, OrgId: 1, Version: 2, Uid: "foo"}

	m := datasources.NewMockCacheService(c)
	s := NewLastSeenDatasourceCache(m, log.NewNopLogger())

	// should return the first version of the datasource
	m.EXPECT().GetDatasource(ctx, int64(2), &user, false).
		Return(&expected1, nil)
	datasource, err := s.GetDatasource(ctx, 2, &user, false)
	require.NoError(t, err)
	require.NotNil(t, datasource)
	assert.Equal(t, expected1, *datasource)

	// should update the UID to ID table
	assert.Len(t, s.uidsToIDs, 1)
	assert.Equal(t, map[string]int64{"foo": 2}, s.uidsToIDs)

	// should return data source not found error
	m.EXPECT().GetDatasource(ctx, int64(2), &user, false).
		Return(nil, datasources.ErrDataSourceNotFound)
	datasource, err = s.GetDatasource(ctx, 2, &user, false)
	assert.EqualError(t, err, "data source not found")
	assert.Nil(t, datasource)

	// should return last seen version of the datasource
	m.EXPECT().GetDatasource(ctx, int64(2), &user, false).
		Return(nil, errors.New("unexpected error"))
	datasource, err = s.GetDatasource(ctx, 2, &user, false)
	require.NoError(t, err)
	require.NotNil(t, datasource)
	assert.Equal(t, expected1, *datasource)

	// update the last seen version of the datasource, should return second
	// version of the datasource
	s.datasources[2] = &expected2
	m.EXPECT().GetDatasource(ctx, int64(2), &user, false).
		Return(nil, errors.New("unexpected error"))
	datasource, err = s.GetDatasource(ctx, 2, &user, false)
	require.NoError(t, err)
	require.NotNil(t, datasource)
	assert.Equal(t, expected2, *datasource)

	// a user in a different org cannot get this datasource
	user = models.SignedInUser{OrgId: 2}
	m.EXPECT().GetDatasource(ctx, int64(2), &user, false).
		Return(nil, errors.New("unexpected error"))
	datasource, err = s.GetDatasource(ctx, 2, &user, false)
	assert.EqualError(t, err, "unexpected error")
	assert.Nil(t, datasource)
}

func TestLastSeenDatasourceCache_GetDatasourceByUID(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	ctx := context.Background()
	user := models.SignedInUser{OrgId: 1}

	expected1 := datasources.DataSource{Id: 2, OrgId: 1, Version: 1, Uid: "foo"}
	expected2 := datasources.DataSource{Id: 2, OrgId: 1, Version: 2, Uid: "foo"}

	m := datasources.NewMockCacheService(c)
	s := NewLastSeenDatasourceCache(m, log.NewNopLogger())

	// should return the first version of the datasource
	m.EXPECT().GetDatasourceByUID(ctx, "foo", &user, false).
		Return(&expected1, nil)
	datasource, err := s.GetDatasourceByUID(ctx, "foo", &user, false)
	require.NoError(t, err)
	require.NotNil(t, datasource)
	assert.Equal(t, expected1, *datasource)

	// should update the UID to ID table
	assert.Len(t, s.uidsToIDs, 1)
	assert.Equal(t, map[string]int64{"foo": 2}, s.uidsToIDs)

	// should return data source not found error
	m.EXPECT().GetDatasourceByUID(ctx, "foo", &user, false).
		Return(nil, datasources.ErrDataSourceNotFound)
	datasource, err = s.GetDatasourceByUID(ctx, "foo", &user, false)
	assert.EqualError(t, err, "data source not found")
	assert.Nil(t, datasource)

	// should return last seen version of the datasource
	m.EXPECT().GetDatasourceByUID(ctx, "foo", &user, false).
		Return(nil, errors.New("unexpected error"))
	datasource, err = s.GetDatasourceByUID(ctx, "foo", &user, false)
	require.NoError(t, err)
	require.NotNil(t, datasource)
	assert.Equal(t, expected1, *datasource)

	// update the last seen version of the datasource, should return second
	// version of the datasource
	s.datasources[2] = &expected2
	m.EXPECT().GetDatasourceByUID(ctx, "foo", &user, false).
		Return(nil, errors.New("unexpected error"))
	datasource, err = s.GetDatasourceByUID(ctx, "foo", &user, false)
	require.NoError(t, err)
	require.NotNil(t, datasource)
	assert.Equal(t, expected2, *datasource)

	// a user in a different org cannot get this datasource
	user = models.SignedInUser{OrgId: 2}
	m.EXPECT().GetDatasourceByUID(ctx, "foo", &user, false).
		Return(nil, errors.New("unexpected error"))
	datasource, err = s.GetDatasourceByUID(ctx, "foo", &user, false)
	assert.EqualError(t, err, "unexpected error")
	assert.Nil(t, datasource)
}
