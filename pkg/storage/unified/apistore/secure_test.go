package apistore

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

func TestSecureUpdates(t *testing.T) {
	store := secret.NewMockInlineSecureValueSupport(t)
	obj, err := resourceFromYAML(t, `
apiVersion: something.grafana.app/v1beta1
kind: CustomKind
metadata:
  name: test
spec:
  title: something
secure:
  a:
    create: secret
	b:
    name: xyz
`)
	require.NoError(t, err)

	info := &objectForStorage{}

	store.On("CreateInline", mock.Anything, mock.Anything, common.RawSecureValue("secret")).
		Return("NAME", nil).Once()

	err = handleSecureValues(context.Background(), store, obj, nil, info)
	require.NoError(t, err)
	require.True(t, info.hasChanged)
	secure, err := obj.GetSecureValues()
	require.NoError(t, err)
	require.JSONEq(t, `{
		"a": {"name": "NAME"},
		"b": {"name": "xyz"}
	}`, asJSON(secure, true))
}

func resourceFromYAML(t *testing.T, body string) (utils.GrafanaMetaAccessor, error) {
	body = strings.ReplaceAll(strings.TrimSpace(body), "\t", "  ")
	fmt.Printf("YAML: %s\n", body)
	decoder := yamlutil.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(body)), 1024)
	var rawObj runtime.RawExtension
	err := decoder.Decode(&rawObj)
	require.NoError(t, err)

	obj, _, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).Decode(rawObj.Raw, nil, nil)
	require.NoError(t, err)
	unstructuredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	require.NoError(t, err)

	return utils.MetaAccessor(&unstructured.Unstructured{Object: unstructuredMap})
}

func asJSON(v any, pretty bool) string {
	if v == nil {
		return ""
	}
	if pretty {
		bytes, _ := json.MarshalIndent(v, "", "  ")
		return string(bytes)
	}
	bytes, _ := json.Marshal(v)
	return string(bytes)
}
