package pipeline

import (
	"errors"
	"fmt"
	"time"

	"github.com/dop251/goja"
	"github.com/dop251/goja/parser"
)

func getRuntime() *goja.Runtime {
	vm := goja.New()
	vm.SetMaxCallStackSize(1024)
	vm.SetParserOptions(parser.WithDisableSourceMaps)
	return vm
}

func runString(vm *goja.Runtime, script string) (goja.Value, error) {
	doneCh := make(chan struct{})
	go func() {
		select {
		case <-doneCh:
			return
		case <-time.After(100 * time.Millisecond):
			// Some ideas to prevent misuse of scripts:
			// * parse/validate scripts on save
			// * block scripts after several timeouts in a row
			// * block scripts on malformed returned error
			// * limit total quota of time for scripts
			// * maybe allow only one statement, reject scripts with cycles and functions.
			vm.Interrupt(errors.New("timeout"))
		}
	}()
	defer close(doneCh)
	return vm.RunString(script)
}

func GetBool(payload []byte, script string) (bool, error) {
	vm := getRuntime()
	err := vm.Set("x", string(payload))
	if err != nil {
		return false, err
	}
	v, err := runString(vm, script)
	if err != nil {
		return false, err
	}
	num, ok := v.Export().(bool)
	if !ok {
		return false, errors.New("unexpected return value")
	}
	return num, nil
}

func GetString(payload []byte, script string) (string, error) {
	vm := getRuntime()
	err := vm.Set("x", string(payload))
	if err != nil {
		return "", err
	}
	v, err := runString(vm, script)
	if err != nil {
		return "", err
	}
	stringVal, ok := v.Export().(string)
	if !ok {
		return "", errors.New("unexpected return value")
	}
	return stringVal, nil
}

func GetFloat64(payload []byte, script string) (float64, error) {
	vm := getRuntime()
	err := vm.Set("x", string(payload))
	if err != nil {
		return 0, err
	}
	v, err := runString(vm, script)
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
