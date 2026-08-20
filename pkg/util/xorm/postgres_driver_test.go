package xorm

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/require"
)

func TestIntegerBoolCodec(t *testing.T) {
	typeMap := pgtype.NewMap()
	registerPostgresCompatibilityTypes(typeMap)

	for _, tc := range []struct {
		name   string
		format int16
		value  any
		want   []byte
	}{
		{name: "binary false", format: pgtype.BinaryFormatCode, value: 0, want: []byte{0}},
		{name: "binary true", format: pgtype.BinaryFormatCode, value: int64(1), want: []byte{1}},
		{name: "text false", format: pgtype.TextFormatCode, value: uint8(0), want: []byte{'f'}},
		{name: "text true", format: pgtype.TextFormatCode, value: uint64(1), want: []byte{'t'}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plan := typeMap.PlanEncode(pgtype.BoolOID, tc.format, tc.value)
			require.NotNil(t, plan)
			got, err := plan.Encode(tc.value, nil)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestIntegerBoolCodecRejectsOtherIntegers(t *testing.T) {
	typeMap := pgtype.NewMap()
	registerPostgresCompatibilityTypes(typeMap)

	plan := typeMap.PlanEncode(pgtype.BoolOID, pgtype.BinaryFormatCode, 2)
	require.NotNil(t, plan)
	_, err := plan.Encode(2, nil)
	require.ErrorContains(t, err, "cannot encode int as PostgreSQL boolean")

	got, err := plan.Encode(0, nil)
	require.NoError(t, err)
	require.Equal(t, []byte{0}, got)
}

func TestIntegerBoolCodecPreservesNativeBoolEncoding(t *testing.T) {
	typeMap := pgtype.NewMap()
	registerPostgresCompatibilityTypes(typeMap)

	plan := typeMap.PlanEncode(pgtype.BoolOID, pgtype.BinaryFormatCode, true)
	require.NotNil(t, plan)
	got, err := plan.Encode(true, nil)
	require.NoError(t, err)
	require.Equal(t, []byte{1}, got)
}
