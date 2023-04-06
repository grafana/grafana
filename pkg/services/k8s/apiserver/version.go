package apiserver

import (
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
)

func getResourceVersion(obj runtime.Object) (uint64, error) {
	if obj == nil {
		return 0, nil
	}
	objMeta, err := meta.Accessor(obj)
	if err != nil {
		return 0, err
	}
	return parseResourceVersion(objMeta.GetResourceVersion())
}

func setResourceVersion(obj runtime.Object, v uint64) error {
	if v <= 0 {
		return fmt.Errorf("resourceVersion must be positive: %d", v)
	}

	objMeta, err := meta.Accessor(obj)
	if err != nil {
		return err
	}
	objMeta.SetResourceVersion(formatResourceVersion(v))
	return nil
}

func clearResourceVersion(obj runtime.Object) error {
	objMeta, err := meta.Accessor(obj)
	if err != nil {
		return err
	}
	objMeta.SetResourceVersion("")
	return nil
}

func parseResourceVersion(v string) (uint64, error) {
	if v == "" {
		return 0, nil
	}
	version, err := strconv.ParseUint(v, 10, 64)
	if err != nil {
		return 0, err
	}
	return version, nil
}

func formatResourceVersion(v uint64) string {
	return strconv.FormatUint(v, 10)
}
