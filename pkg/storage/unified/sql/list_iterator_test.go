package sql

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db/mocks"
)

func TestListIter_NextSurfacesRowsErr(t *testing.T) {
	rows := mocks.NewRows(t)
	iterErr := errors.New("mid-iteration database failure")
	rows.On("Next").Return(false)
	rows.On("Err").Return(iterErr)

	iter := &listIter{rows: rows}
	require.False(t, iter.Next())
	require.ErrorIs(t, iter.Error(), iterErr)
}

func TestListIter_NextEndOfRowsIsNotError(t *testing.T) {
	rows := mocks.NewRows(t)
	rows.On("Next").Return(false)
	rows.On("Err").Return(nil)

	iter := &listIter{rows: rows}
	require.False(t, iter.Next())
	require.NoError(t, iter.Error())
}