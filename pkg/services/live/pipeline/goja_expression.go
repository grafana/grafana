package pipeline

import (
	"errors"
	"fmt"

	"github.com/dop251/goja"
)

func GetBool(payload []byte, script string) (bool, error) {
	vm := goja.New()
	err := vm.Set("x", string(payload))
	if err != nil {
		return false, err
	}
	v, err := vm.RunString(script)
	if err != nil {
		return false, err
	}
	num, ok := v.Export().(bool)
	if !ok {
		return false, errors.New("unexpected return value")
	}
	return num, nil
}

func GetFloat64(payload []byte, script string) (float64, error) {
	vm := goja.New()
	err := vm.Set("x", string(payload))
	if err != nil {
		return 0, err
	}
	v, err := vm.RunString(script)
	if err != nil {
		return 0, err
	}
	exported := v.Export()
	switch exported.(type) {
	case float64:
		return exported.(float64), nil
	case int64:
		return float64(exported.(int64)), nil
	default:
		return 0, fmt.Errorf("unexpected return value: %T", exported)
	}
}
