package searchV2

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_punctuationCharFilter_Filter(t1 *testing.T) {
	type args struct {
		input []byte
	}
	tests := []struct {
		name string
		args args
		want []byte
	}{
		{
			name: "1",
			args: args{
				input: []byte("x-Rays"),
			},
			want: []byte("x Rays"),
		},
		{
			name: "2",
			args: args{
				input: []byte("x.Rays"),
			},
			want: []byte("x Rays"),
		},
		{
			name: "3",
			args: args{
				input: []byte("[x,Rays]"),
			},
			want: []byte(" x Rays "),
		},
	}
	for _, tt := range tests {
		t1.Run(tt.name, func(t1 *testing.T) {
			t := &punctuationCharFilter{}
			if got := t.Filter(tt.args.input); !reflect.DeepEqual(got, tt.want) {
				t1.Errorf("Filter() = %v, want %v", string(got), string(tt.want))
			}
		})
	}
}

func TestNgramIndexAnalyzer(t *testing.T) {
	stream := ngramIndexAnalyzer.Analyze([]byte("x-rays.and.xRays, and НемногоКириллицы"))
	expectedTerms := []string{"x", "r", "ra", "ray", "rays", "a", "an", "and", "x", "r", "ra", "ray", "rays", "a", "an", "and", "н", "не", "нем", "немн", "немно", "немног", "немного", "к", "ки", "кир", "кири", "кирил", "кирилл", "кирилли"}
	var actualTerms []string
	for _, t := range stream {
		actualTerms = append(actualTerms, string(t.Term))
	}
	require.Equal(t, expectedTerms, actualTerms)
}
