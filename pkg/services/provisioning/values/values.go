// Package values is a set of value types to use in provisioning. They add custom unmarshaling logic that puts the string values
// through os.ExpandEnv.
// Usage:
// type Data struct {
//   Field StringValue `yaml:"field"` // Instead of string
// }
// d := &Data{}
// // unmarshal into d
// d.Field.Value() // returns the final interpolated value from the yaml file
//
package values

import (
	"os"
	"reflect"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/util/errutil"
)

type IntValue struct {
	value int
	Raw   string
}

func (val *IntValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	interpolated, err := getInterpolated(unmarshal)
	if err != nil {
		return err
	}
	if len(interpolated.value) == 0 {
		// To keep the same behaviour as the yaml lib which just does not set the value if it is empty.
		return nil
	}
	val.Raw = interpolated.raw
	val.value, err = strconv.Atoi(interpolated.value)
	return errutil.Wrap("cannot convert value int", err)
}

func (val *IntValue) Value() int {
	return val.value
}

type Int64Value struct {
	value int64
	Raw   string
}

func (val *Int64Value) UnmarshalYAML(unmarshal func(interface{}) error) error {
	interpolated, err := getInterpolated(unmarshal)
	if err != nil {
		return err
	}
	if len(interpolated.value) == 0 {
		// To keep the same behaviour as the yaml lib which just does not set the value if it is empty.
		return nil
	}
	val.Raw = interpolated.raw
	val.value, err = strconv.ParseInt(interpolated.value, 10, 64)
	return err
}

func (val *Int64Value) Value() int64 {
	return val.value
}

type StringValue struct {
	value string
	Raw   string
}

func (val *StringValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	interpolated, err := getInterpolated(unmarshal)
	if err != nil {
		return err
	}
	val.Raw = interpolated.raw
	val.value = interpolated.value
	return err
}

func (val *StringValue) Value() string {
	return val.value
}

type BoolValue struct {
	value bool
	Raw   string
}

func (val *BoolValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	interpolated, err := getInterpolated(unmarshal)
	if err != nil {
		return err
	}
	val.Raw = interpolated.raw
	val.value, err = strconv.ParseBool(interpolated.value)
	return err
}

func (val *BoolValue) Value() bool {
	return val.value
}

type JSONValue struct {
	value map[string]interface{}
	Raw   map[string]interface{}
}

func (val *JSONValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	unmarshaled := make(map[string]interface{})
	err := unmarshal(unmarshaled)
	if err != nil {
		return err
	}
	interpolated := make(map[string]interface{})
	raw := make(map[string]interface{})
	for key, val := range unmarshaled {
		interpolated[key], raw[key] = transformInterface(val)
	}

	val.Raw = raw
	val.value = interpolated
	return err
}

func (val *JSONValue) Value() map[string]interface{} {
	return val.value
}

type StringMapValue struct {
	value map[string]string
	Raw   map[string]string
}

func (val *StringMapValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	unmarshaled := make(map[string]string)
	err := unmarshal(unmarshaled)
	if err != nil {
		return err
	}
	interpolated := make(map[string]string)
	raw := make(map[string]string)
	for key, val := range unmarshaled {
		interpolated[key], raw[key] = interpolateValue(val)
	}
	val.Raw = raw
	val.value = interpolated
	return err
}

func (val *StringMapValue) Value() map[string]string {
	return val.value
}

// transformInterface tries to transform any interface type into proper value with env expansion. It travers maps and
// slices and the actual interpolation is done on all simple string values in the structure. It returns a copy of any
// map or slice value instead of modifying them in place and also return value without interpolation but with converted
// type as a second value.
func transformInterface(i interface{}) (interface{}, interface{}) {
	typeOf := reflect.TypeOf(i)

	if typeOf == nil {
		return nil, nil
	}

	switch typeOf.Kind() {
	case reflect.Slice:
		return transformSlice(i.([]interface{}))
	case reflect.Map:
		return transformMap(i.(map[interface{}]interface{}))
	case reflect.String:
		return interpolateValue(i.(string))
	default:
		// Was int, float or some other value that we do not need to do any transform on.
		return i, i
	}
}

func transformSlice(i []interface{}) (interface{}, interface{}) {
	var transformedSlice []interface{}
	var rawSlice []interface{}
	for _, val := range i {
		transformed, raw := transformInterface(val)
		transformedSlice = append(transformedSlice, transformed)
		rawSlice = append(rawSlice, raw)
	}
	return transformedSlice, rawSlice
}

func transformMap(i map[interface{}]interface{}) (interface{}, interface{}) {
	transformed := make(map[string]interface{})
	raw := make(map[string]interface{})
	for key, val := range i {
		stringKey, ok := key.(string)
		if ok {
			transformed[stringKey], raw[stringKey] = transformInterface(val)
		}
	}
	return transformed, raw
}

// interpolateValue returns final value after interpolation. At the moment only env var interpolation is done
// here but in the future something like interpolation from file could be also done here.
// For a literal '$', '$$' can be used to avoid interpolation.
func interpolateValue(val string) (string, string) {
	parts := strings.Split(val, "$$")
	interpolated := make([]string, len(parts))
	for i, v := range parts {
		interpolated[i] = os.ExpandEnv(v)
	}
	return strings.Join(interpolated, "$"), val
}

type interpolated struct {
	value string
	raw   string
}

// getInterpolated unmarshals the value as string and runs interpolation on it. It is the responsibility of each
// value type to convert this string value to appropriate type.
func getInterpolated(unmarshal func(interface{}) error) (*interpolated, error) {
	var veryRaw string
	err := unmarshal(&veryRaw)
	if err != nil {
		return &interpolated{}, err
	}
	// We get new raw value here which can have a bit different type, as yaml types nested maps as
	// map[interface{}]interface and we want it to be map[string]interface{}
	value, raw := interpolateValue(veryRaw)
	return &interpolated{raw: raw, value: value}, nil
}
