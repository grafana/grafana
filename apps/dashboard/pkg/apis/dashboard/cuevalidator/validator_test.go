package cuevalidator

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"strings"
	"sync"
	"testing"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	cuejson "cuelang.org/go/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
	const schema = `
Other: int
#Spec: {
	title: string
	count: int & >=0
	kind: "panel" | "row"
	note?: string
}`
	tests := []struct {
		name    string
		data    string
		wantErr bool
	}{
		{name: "valid", data: `{"title":"dashboard","count":1,"kind":"panel"}`},
		{name: "escaped string", data: `{"title":"dashboard","count":1,"kind":"row","note":"\\(literal)\n\"quoted\""}`},
		{name: "wrong type", data: `{"title":123,"count":1,"kind":"panel"}`, wantErr: true},
		{name: "constraint", data: `{"title":"dashboard","count":-1,"kind":"panel"}`, wantErr: true},
		{name: "disjunction", data: `{"title":"dashboard","count":1,"kind":"unknown"}`, wantErr: true},
		{name: "unknown field", data: `{"title":"dashboard","count":1,"kind":"panel","unknown":true}`, wantErr: true},
		{name: "malformed JSON", data: `{"title":`, wantErr: true},
		{name: "CUE is not JSON", data: `{title: "dashboard", count: 1, kind: "panel"}`, wantErr: true},
	}
	validator := NewValidatorFromSource(schema, cue.ParsePath("#Spec"))
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := []byte(tt.data)
			err := validator.Validate(data)
			if !tt.wantErr {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			reference := cuecontext.New().CompileString(schema).LookupPath(cue.ParsePath("#Spec"))
			want := errors.Errors(cuejson.Validate(data, reference))
			got := errors.Errors(err)
			require.Len(t, got, len(want))
			for i, e := range got {
				assert.Equal(t, want[i].Path(), e.Path())
				wantFormat, wantArgs := want[i].Msg()
				gotFormat, gotArgs := e.Msg()
				assert.Equal(t, fmt.Sprintf(wantFormat, wantArgs...), fmt.Sprintf(gotFormat, gotArgs...))
			}
		})
	}
}

func TestValidateDoesNotRetainPayloads(t *testing.T) {
	validator := NewValidatorFromSource(`values: [...number]`, cue.ParsePath(""))
	data := []byte(`{"values":[` + strings.Repeat("12345,", 9999) + `12345]}`)
	require.NoError(t, validator.Validate(data))
	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)

	// Cover infrequent dashboard writes that stayed below the old 100-call reset threshold.
	for range 20 {
		require.NoError(t, validator.Validate(data))
	}
	runtime.GC()
	var after runtime.MemStats
	runtime.ReadMemStats(&after)
	runtime.KeepAlive(validator)

	const maxRetainedBytes = 8 << 20
	retained := int64(after.HeapAlloc) - int64(before.HeapAlloc)
	t.Logf("retained heap after 20 validations: %d bytes", retained)
	assert.Less(t, retained, int64(maxRetainedBytes), "validated payloads must be collectible while the validator remains alive")
}

func TestValidateConcurrent(t *testing.T) {
	validator := NewValidatorFromSource(`value: int & >=0`, cue.ParsePath(""))
	var wg sync.WaitGroup
	for range 10 {
		wg.Go(func() {
			for range 25 {
				assert.NoError(t, validator.Validate([]byte(`{"value":1}`)))
				assert.Error(t, validator.Validate([]byte(`{"value":-1}`)))
			}
		})
	}
	wg.Wait()
}

func BenchmarkValidateDashboardSpec(b *testing.B) {
	schema, err := os.ReadFile("../v2/dashboard_spec.cue")
	require.NoError(b, err)
	data, err := os.ReadFile("../../../migration/conversion/testdata/input/migrated_dashboards_from_v0_to_v2/v2beta1.v38.timeseries_table_display_mode.json")
	require.NoError(b, err)
	var dashboard struct {
		Spec json.RawMessage `json:"spec"`
	}
	require.NoError(b, json.Unmarshal(data, &dashboard))
	validator := NewValidatorFromSource(string(schema), cue.ParsePath("DashboardSpec"))
	b.ReportAllocs()
	for b.Loop() {
		require.NoError(b, validator.Validate(dashboard.Spec))
	}
}
