package pipeline

import (
	"errors"
	"fmt"
	"time"

	"github.com/dop251/goja"
	"github.com/dop251/goja/parser"
)

type gojaRuntime struct {
	vm *goja.Runtime
}

func getRuntime(payload []byte) (*gojaRuntime, error) {
	vm := goja.New()
	vm.SetMaxCallStackSize(1024)
	vm.SetParserOptions(parser.WithDisableSourceMaps)
	r := &gojaRuntime{vm}
	err := r.init(payload)
	if err != nil {
		return nil, err
	}
	return r, nil
}

// Parse JSON once.
func (r *gojaRuntime) init(payload []byte) error {
	err := r.vm.Set("__body", string(payload))
	if err != nil {
		return err
	}
	_, err = r.runString(`var x = JSON.parse(__body)`)
	return err
}

func (r *gojaRuntime) runString(script string) (goja.Value, error) {
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
			r.vm.Interrupt(errors.New("timeout"))
		}
	}()
	defer close(doneCh)
	return r.vm.RunString(script)
}

func (r *gojaRuntime) getBool(script string) (bool, error) {
	v, err := r.runString(script)
	if err != nil {
		return false, err
	}
	num, ok := v.Export().(bool)
	if !ok {
		return false, errors.New("unexpected return value")
	}
	return num, nil
}

func (r *gojaRuntime) getString(script string) (string, error) {
	v, err := r.runString(script)
	if err != nil {
		return "", err
	}
	stringVal, ok := v.Export().(string)
	if !ok {
		return "", errors.New("unexpected return value")
	}
	return stringVal, nil
}

func (r *gojaRuntime) getFloat64(script string) (float64, error) {
	v, err := r.runString(script)
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
