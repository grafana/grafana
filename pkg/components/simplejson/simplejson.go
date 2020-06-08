// Package simplejson provides a wrapper for arbitrary JSON objects that adds methods to access properties.
// Use of this package in place of types and the standard library's encoding/json package is strongly discouraged.
package simplejson

import (
	"bytes"
	"encoding/json"
	"errors"
	"log"
)

// returns the current implementation version
func Version() string {
	return "0.5.0"
}

type Json struct {
	data interface{}
}

func (j *Json) FromDB(data []byte) error {
	j.data = make(map[string]interface{})

	dec := json.NewDecoder(bytes.NewBuffer(data))
	dec.UseNumber()
	return dec.Decode(&j.data)
}

func (j *Json) ToDB() ([]byte, error) {
	if j == nil || j.data == nil {
		return nil, nil
	}

	return j.Encode()
}

// NewJson returns a pointer to a new `Json` object
// after unmarshaling `body` bytes
func NewJson(body []byte) (*Json, error) {
	j := new(Json)
	err := j.UnmarshalJSON(body)
	if err != nil {
		return nil, err
	}
	return j, nil
}

// New returns a pointer to a new, empty `Json` object
func New() *Json {
	return &Json{
		data: make(map[string]interface{}),
	}
}

// New returns a pointer to a new, empty `Json` object
func NewFromAny(data interface{}) *Json {
	return &Json{data: data}
}

// Interface returns the underlying data
func (j *Json) Interface() interface{} {
	return j.data
}

// Encode returns its marshaled data as `[]byte`
func (j *Json) Encode() ([]byte, error) {
	return j.MarshalJSON()
}

// EncodePretty returns its marshaled data as `[]byte` with indentation
func (j *Json) EncodePretty() ([]byte, error) {
	return json.MarshalIndent(&j.data, "", "  ")
}

// Implements the json.Marshaler interface.
func (j *Json) MarshalJSON() ([]byte, error) {
	return json.Marshal(&j.data)
}

// Set modifies `Json` map by `key` and `value`
// Useful for changing single key/value in a `Json` object easily.
func (j *Json) Set(key string, val interface{}) {
	m, err := j.Map()
	if err != nil {
		return
	}
	m[key] = val
}

// SetPath modifies `Json`, recursively checking/creating map keys for the supplied path,
// and then finally writing in the value
func (j *Json) SetPath(branch []string, val interface{}) {
	if len(branch) == 0 {
		j.data = val
		return
	}

	// in order to insert our branch, we need map[string]interface{}
	if _, ok := (j.data).(map[string]interface{}); !ok {
		// have to replace with something suitable
		j.data = make(map[string]interface{})
	}
	curr := j.data.(map[string]interface{})

	for i := 0; i < len(branch)-1; i++ {
		b := branch[i]
		// key exists?
		if _, ok := curr[b]; !ok {
			n := make(map[string]interface{})
			curr[b] = n
			curr = n
			continue
		}

		// make sure the value is the right sort of thing
		if _, ok := curr[b].(map[string]interface{}); !ok {
			// have to replace with something suitable
			n := make(map[string]interface{})
			curr[b] = n
		}

		curr = curr[b].(map[string]interface{})
	}

	// add remaining k/v
	curr[branch[len(branch)-1]] = val
}

// Del modifies `Json` map by deleting `key` if it is present.
func (j *Json) Del(key string) {
	m, err := j.Map()
	if err != nil {
		return
	}
	delete(m, key)
}

// Get returns a pointer to a new `Json` object
// for `key` in its `map` representation
//
// useful for chaining operations (to traverse a nested JSON):
//    js.Get("top_level").Get("dict").Get("value").Int()
func (j *Json) Get(key string) *Json {
	m, err := j.Map()
	if err == nil {
		if val, ok := m[key]; ok {
			return &Json{val}
		}
	}
	return &Json{nil}
}

// GetPath searches for the item as specified by the branch
// without the need to deep dive using Get()'s.
//
//   js.GetPath("top_level", "dict")
func (j *Json) GetPath(branch ...string) *Json {
	jin := j
	for _, p := range branch {
		jin = jin.Get(p)
	}
	return jin
}

// GetIndex returns a pointer to a new `Json` object
// for `index` in its `array` representation
//
// this is the analog to Get when accessing elements of
// a json array instead of a json object:
//    js.Get("top_level").Get("array").GetIndex(1).Get("key").Int()
func (j *Json) GetIndex(index int) *Json {
	a, err := j.Array()
	if err == nil {
		if len(a) > index {
			return &Json{a[index]}
		}
	}
	return &Json{nil}
}

// CheckGet returns a pointer to a new `Json` object and
// a `bool` identifying success or failure
//
// useful for chained operations when success is important:
//    if data, ok := js.Get("top_level").CheckGet("inner"); ok {
//        log.Println(data)
//    }
func (j *Json) CheckGet(key string) (*Json, bool) {
	m, err := j.Map()
	if err == nil {
		if val, ok := m[key]; ok {
			return &Json{val}, true
		}
	}
	return nil, false
}

// Map type asserts to `map`
func (j *Json) Map() (map[string]interface{}, error) {
	if m, ok := (j.data).(map[string]interface{}); ok {
		return m, nil
	}
	return nil, errors.New("type assertion to map[string]interface{} failed")
}

// Array type asserts to an `array`
func (j *Json) Array() ([]interface{}, error) {
	if a, ok := (j.data).([]interface{}); ok {
		return a, nil
	}
	return nil, errors.New("type assertion to []interface{} failed")
}

// Bool type asserts to `bool`
func (j *Json) Bool() (bool, error) {
	if s, ok := (j.data).(bool); ok {
		return s, nil
	}
	return false, errors.New("type assertion to bool failed")
}

// String type asserts to `string`
func (j *Json) String() (string, error) {
	if s, ok := (j.data).(string); ok {
		return s, nil
	}
	return "", errors.New("type assertion to string failed")
}

// Bytes type asserts to `[]byte`
func (j *Json) Bytes() ([]byte, error) {
	if s, ok := (j.data).(string); ok {
		return []byte(s), nil
	}
	return nil, errors.New("type assertion to []byte failed")
}

// StringArray type asserts to an `array` of `string`
func (j *Json) StringArray() ([]string, error) {
	arr, err := j.Array()
	if err != nil {
		return nil, err
	}
	retArr := make([]string, 0, len(arr))
	for _, a := range arr {
		if a == nil {
			retArr = append(retArr, "")
			continue
		}
		s, ok := a.(string)
		if !ok {
			return nil, err
		}
		retArr = append(retArr, s)
	}
	return retArr, nil
}

// MustArray guarantees the return of a `[]interface{}` (with optional default)
//
// useful when you want to iterate over array values in a succinct manner:
//		for i, v := range js.Get("results").MustArray() {
//			fmt.Println(i, v)
//		}
func (j *Json) MustArray(args ...[]interface{}) []interface{} {
	var def []interface{}

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustArray() received too many arguments %d", len(args))
	}

	a, err := j.Array()
	if err == nil {
		return a
	}

	return def
}

// MustMap guarantees the return of a `map[string]interface{}` (with optional default)
//
// useful when you want to iterate over map values in a succinct manner:
//		for k, v := range js.Get("dictionary").MustMap() {
//			fmt.Println(k, v)
//		}
func (j *Json) MustMap(args ...map[string]interface{}) map[string]interface{} {
	var def map[string]interface{}

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustMap() received too many arguments %d", len(args))
	}

	a, err := j.Map()
	if err == nil {
		return a
	}

	return def
}

// MustString guarantees the return of a `string` (with optional default)
//
// useful when you explicitly want a `string` in a single value return context:
//     myFunc(js.Get("param1").MustString(), js.Get("optional_param").MustString("my_default"))
func (j *Json) MustString(args ...string) string {
	var def string

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustString() received too many arguments %d", len(args))
	}

	s, err := j.String()
	if err == nil {
		return s
	}

	return def
}

// MustStringArray guarantees the return of a `[]string` (with optional default)
//
// useful when you want to iterate over array values in a succinct manner:
//		for i, s := range js.Get("results").MustStringArray() {
//			fmt.Println(i, s)
//		}
func (j *Json) MustStringArray(args ...[]string) []string {
	var def []string

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustStringArray() received too many arguments %d", len(args))
	}

	a, err := j.StringArray()
	if err == nil {
		return a
	}

	return def
}

// MustInt guarantees the return of an `int` (with optional default)
//
// useful when you explicitly want an `int` in a single value return context:
//     myFunc(js.Get("param1").MustInt(), js.Get("optional_param").MustInt(5150))
func (j *Json) MustInt(args ...int) int {
	var def int

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustInt() received too many arguments %d", len(args))
	}

	i, err := j.Int()
	if err == nil {
		return i
	}

	return def
}

// MustFloat64 guarantees the return of a `float64` (with optional default)
//
// useful when you explicitly want a `float64` in a single value return context:
//     myFunc(js.Get("param1").MustFloat64(), js.Get("optional_param").MustFloat64(5.150))
func (j *Json) MustFloat64(args ...float64) float64 {
	var def float64

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustFloat64() received too many arguments %d", len(args))
	}

	f, err := j.Float64()
	if err == nil {
		return f
	}

	return def
}

// MustBool guarantees the return of a `bool` (with optional default)
//
// useful when you explicitly want a `bool` in a single value return context:
//     myFunc(js.Get("param1").MustBool(), js.Get("optional_param").MustBool(true))
func (j *Json) MustBool(args ...bool) bool {
	var def bool

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustBool() received too many arguments %d", len(args))
	}

	b, err := j.Bool()
	if err == nil {
		return b
	}

	return def
}

// MustInt64 guarantees the return of an `int64` (with optional default)
//
// useful when you explicitly want an `int64` in a single value return context:
//     myFunc(js.Get("param1").MustInt64(), js.Get("optional_param").MustInt64(5150))
func (j *Json) MustInt64(args ...int64) int64 {
	var def int64

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustInt64() received too many arguments %d", len(args))
	}

	i, err := j.Int64()
	if err == nil {
		return i
	}

	return def
}

// MustUInt64 guarantees the return of an `uint64` (with optional default)
//
// useful when you explicitly want an `uint64` in a single value return context:
//     myFunc(js.Get("param1").MustUint64(), js.Get("optional_param").MustUint64(5150))
func (j *Json) MustUint64(args ...uint64) uint64 {
	var def uint64

	switch len(args) {
	case 0:
	case 1:
		def = args[0]
	default:
		log.Panicf("MustUint64() received too many arguments %d", len(args))
	}

	i, err := j.Uint64()
	if err == nil {
		return i
	}

	return def
}
