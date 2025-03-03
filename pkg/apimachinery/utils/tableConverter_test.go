package utils_test

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestTableConverter(t *testing.T) {
	// dummy converter
	converter := utils.NewTableConverter(
		schema.GroupResource{Group: "x", Resource: "y"},
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Dummy", Type: "string", Format: "string", Description: "Something here"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*metav1.APIGroup)
				if !ok {
					return nil, fmt.Errorf("expected status")
				}
				ts := metav1.NewTime(time.UnixMilli(10000000))
				return []interface{}{
					m.Name,
					"dummy",
					ts.Time.UTC().Format(time.RFC3339),
				}, nil
			},
		},
	)

	// Convert a single table
	table, err := converter.ConvertToTable(context.Background(), &metav1.APIGroup{
		Name: "hello",
	}, nil)
	require.NoError(t, err)
	out, err := json.MarshalIndent(table, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"metadata": {},
		"columnDefinitions": [
		  {
			"name": "Name",
			"type": "string",
			"format": "name",
			"description": "Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names",
			"priority": 0
		  },
		  {
			"name": "Dummy",
			"type": "string",
			"format": "string",
			"description": "Something here",
			"priority": 0
		  },
		  {
			"name": "Created At",
			"type": "date",
			"format": "",
			"description": "CreationTimestamp is a timestamp representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations. Clients may not set this value. It is represented in RFC3339 form and is in UTC.\n\nPopulated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata",
			"priority": 0
		  }
		],
		"rows": [
		  {
			"cells": [
			  "hello",
			  "dummy",
			  "1970-01-01T02:46:40Z"
			],
			"object": {
			  "name": "hello",
			  "versions": null,
			  "preferredVersion": {
				"groupVersion": "",
				"version": ""
			  }
			}
		  }
		]
	  }`, string(out))

	// Convert something else
	table, err = converter.ConvertToTable(context.Background(), &metav1.Status{}, nil)
	require.Error(t, err)
	require.Nil(t, table)
	require.Equal(t, "the resource y.x does not support being converted to a Table", err.Error())

	// Default table converter
	// Convert a single table
	converter = utils.NewTableConverter(schema.GroupResource{Group: "x", Resource: "y"}, utils.TableColumns{})
	table, err = converter.ConvertToTable(context.Background(), &metav1.APIGroup{
		Name: "hello",
	}, nil)
	require.NoError(t, err)
	out, err = json.MarshalIndent(table.Rows, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s", string(out))
	require.JSONEq(t, `[
		{
		  "cells": [
			"hello",
			""
		  ],
		  "object": {
			"name": "hello",
			"versions": null,
			"preferredVersion": {
			  "groupVersion": "",
			  "version": ""
			}
		  }
		}
	  ]`, string(out))
}
