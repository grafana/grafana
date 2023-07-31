package main

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/build/config"
)

func Test_getVersionFolder(t *testing.T) {
	type args struct {
		cfg           uploadConfig
		event         string
		versionFolder string
	}
	tests := []struct {
		name string
		args args
		err  error
	}{
		{"tag mode", args{uploadConfig{versionMode: config.TagMode}, "", releaseFolder}, nil},
		{"main mode", args{uploadConfig{versionMode: config.MainMode}, "", mainFolder}, nil},
		{"downstream mode", args{uploadConfig{versionMode: config.DownstreamMode}, "", mainFolder}, nil},
		{"release branch mode", args{uploadConfig{versionMode: config.ReleaseBranchMode}, "", releaseBranchFolder}, nil},
		{"enterprise pro mode", args{uploadConfig{versionMode: config.Enterprise2Mode}, config.Custom, releaseFolder}, nil},
		{"cloud mode", args{uploadConfig{versionMode: config.CloudMode}, "", releaseFolder}, nil},
		{"unrecognised version mode", args{uploadConfig{versionMode: "foo"}, config.Custom, ""}, errors.New("")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			versionMode, err := getVersionFolder(tt.args.cfg, tt.args.event)
			if tt.err != nil {
				require.Error(t, err)
			}
			require.Equal(t, versionMode, tt.args.versionFolder)
		})
	}
}

func Test_checkForEnterprise2Edition(t *testing.T) {
	type args struct {
		releaseModeConfig *config.BuildConfig
		event             string
	}
	tests := []struct {
		name string
		args args
		want string
		err  error
	}{
		{"event is not custom", args{releaseModeConfig: &config.BuildConfig{Buckets: config.Buckets{ArtifactsEnterprise2: "dummy"}}}, "dummy", nil},
		{"event is not custom and string is empty", args{releaseModeConfig: &config.BuildConfig{Buckets: config.Buckets{ArtifactsEnterprise2: ""}}}, "", fmt.Errorf("enterprise2 bucket var doesn't exist")},
		{"event is custom", args{releaseModeConfig: nil, event: "custom"}, "grafana-downloads-enterprise2", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := bucketForEnterprise2(tt.args.releaseModeConfig, tt.args.event)
			if tt.err != nil {
				require.Error(t, err)
			}
			assert.Equalf(t, tt.want, got, "bucketForEnterprise2(%v, %v)", tt.args.releaseModeConfig, tt.args.event)
		})
	}
}
