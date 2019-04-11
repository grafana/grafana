// A set of value types to use in provisioning. They add custom unmarshaling logic that puts the string values
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
	"github.com/pkg/errors"
	"os"
	"reflect"
	"strconv"
)

// Can be changed for testing
var getEnv = os.Getenv

type IntValue struct {
	value int
}

func (val *IntValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	strValue, err := getInterpolated(unmarshal)
	if err != nil {
		return err
	}
	if len(strValue) == 0 {
		// To keep the same behaviour as the yaml lib which just does not set the value if it is empty.
		return nil
	}
	val.value, err = strconv.Atoi(strValue)
	return errors.Wrap(err, "cannot convert value int")
}

func (val *IntValue) Value() int {
	return val.value
}

type Int64Value struct {
	value int64
}

func (val *Int64Value) UnmarshalYAML(unmarshal func(interface{}) error) error {
	strValue, err := getInterpolated(unmarshal)
	if err != nil {
		return err
	}
	if len(strValue) == 0 {
		// To keep the same behaviour as the yaml lib which just does not set the value if it is empty.
		return nil
	}
	val.value, err = strconv.ParseInt(strValue, 10, 64)
	return err
}

func (val *Int64Value) Value() int64 {
	return val.value
}

type StringValue struct {
	value string
}

func (val *StringValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	strValue, err := getInterpolated(unmarshal)
	val.value = strValue
	return err
}

func (val *StringValue) Value() string {
	return val.value
}

type BoolValue struct {
	value bool
}

func (val *BoolValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	strValue, err := getInterpolated(unmarshal)
	if err != nil {
		return err
	}
	val.value, err = strconv.ParseBool(strValue)
	return err
}

func (val *BoolValue) Value() bool {
	return val.value
}

type JSONValue struct {
	value map[string]interface{}
}

func (val *JSONValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	d := make(map[string]interface{})
	err := unmarshal(d)
	if err != nil {
		return err
	}
	for key, val := range d {
		d[key] = tranformInterface(val)
	}
	val.value = d
	return err
}

func (val *JSONValue) Value() map[string]interface{} {
	return val.value
}

type StringMapValue struct {
	value map[string]string
}

func (val *StringMapValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	d := make(map[string]string)
	err := unmarshal(d)
	if err != nil {
		return err
	}
	for key, val := range d {
		d[key] = interpolateValue(val)
	}
	val.value = d
	return err
}

func (val *StringMapValue) Value() map[string]string {
	return val.value
}

// tranformInterface tries to transform any interface type into proper value with env expansion. It travers maps and
// slices and the actual interpolation is done on all simple string values in the structure.
func tranformInterface(i interface{}) interface{} {
	switch reflect.TypeOf(i).Kind() {
	case reflect.Slice:
		return transformSlice(i.([]interface{}))
	case reflect.Map:
		return transformMap(i.(map[interface{}]interface{}))
	case reflect.String:
		return interpolateValue(i.(string))
	default:
		// Was int, float or some other value that we do not need to do any transform on.
		return i
	}
}

func transformSlice(i []interface{}) interface{} {
	var transformed []interface{}
	for _, val := range i {
		transformed = append(transformed, tranformInterface(val))
	}
	return transformed
}

func transformMap(i map[interface{}]interface{}) interface{} {
	transformed := make(map[interface{}]interface{})
	for key, val := range i {
		transformed[key] = tranformInterface(val)
	}
	return transformed
}

// interpolateValue returns final value after interpolation. At the moment only env var interpolation is done
// here but in the future something like interpolation from file could be also done here.
func interpolateValue(val string) string {
	return os.Expand(val, getEnv)
}

// getInterpolated unmarshals the value as string and runs interpolation on it. It is the responsibility of each
// value type to convert this string value to appropriate type.
func getInterpolated(unmarshal func(interface{}) error) (string, error) {
	var d string
	err := unmarshal(&d)
	if err != nil {
		return "", err
	}
	d = interpolateValue(d)
	return d, nil
}
