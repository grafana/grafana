package gou

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Convert a slice of bytes into an array by ensuring it is wrapped
//  with []
func MakeJsonList(b []byte) []byte {
	if !bytes.HasPrefix(b, []byte{'['}) {
		b = append([]byte{'['}, b...)
		b = append(b, ']')
	}
	return b
}

func JsonString(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return `""`
	}
	return string(b)
}

type JsonRawWriter struct {
	bytes.Buffer
}

func (m *JsonRawWriter) MarshalJSON() ([]byte, error) {
	return m.Bytes(), nil
}

func (m *JsonRawWriter) Raw() json.RawMessage {
	return json.RawMessage(m.Bytes())
}

// A simple wrapper to help json data be consumed when not
// using Strongly typed structs.
type JsonInterface struct {
	data interface{}
}

// Encode returns its marshaled data as `[]byte`
func (j *JsonInterface) Encode() ([]byte, error) {
	return j.MarshalJSON()
}

// Implements the json.Marshaler interface.
func (j *JsonInterface) MarshalJSON() ([]byte, error) {
	return json.Marshal(&j.data)
}

// Implements the json.Unmarshal interface.
func (j *JsonInterface) UnmarshalJSON(raw []byte) error {
	return json.Unmarshal(raw, &j.data)
}

// Coerce to a String
func (j *JsonInterface) String() (string, error) {
	return CoerceString(j.data)
}

// Coerce to a string, may be zero length if missing, or zero length
func (j JsonInterface) StringSh() string {
	val, _ := CoerceString(j.data)
	return val
}

// Coerce to Int
func (j *JsonInterface) Int() (int, error) {
	return CoerceInt(j.data)
}

// Coerce to Int, 0 returned if missing or zero
func (j JsonInterface) IntSh() int {
	val, _ := CoerceInt(j.data)
	return val
}

// Coerce to Float, return err if needed
func (j *JsonInterface) Float() (float32, error) {
	val, err := CoerceFloat(j.data)
	return float32(val), err
}

// Coerce to Float, 0 returned if 0 or missing
func (j JsonInterface) FloatSh() float32 {
	val, _ := CoerceFloat(j.data)
	return float32(val)
}

// A wrapper around a map[string]interface{} to facilitate coercion
// of json data to what you want
//
// allows usage such as this
//
//		jh := NewJsonHelper([]byte(`{
//			"name":"string",
//			"ints":[1,5,9,11],
//			"int":1,
//			"int64":1234567890,
//			"MaxSize" : 1048576,
//			"strings":["string1"],
//			"nested":{
//				"nest":"string2",
//				"strings":["string1"],
//				"int":2,
//				"list":["value"],
//				"nest2":{
//					"test":"good"
//				}
//			},
//			"nested2":[
//				{"sub":5}
//			]
//		}`)
//
//		i := jh.Int("nested.int")  // 2
//		i2 := jh.Int("ints[1]")    // 5   array position 1 from [1,5,9,11]
//		s := jh.String("nested.nest")  // "string2"
//
type JsonHelper map[string]interface{}

func NewJsonHelper(b []byte) JsonHelper {
	jh := make(JsonHelper)
	json.Unmarshal(b, &jh)
	return jh
}

func NewJsonHelperReader(r io.Reader) (jh JsonHelper, err error) {
	jh = make(JsonHelper)
	err = json.NewDecoder(r).Decode(&jh)
	return
}

func NewJsonHelpers(b []byte) []JsonHelper {
	var jhl []JsonHelper
	json.Unmarshal(MakeJsonList(b), &jhl)
	return jhl
}

// Make a JsonHelper from http response.   This will automatically
// close the response body
func NewJsonHelperFromResp(resp *http.Response) (JsonHelper, error) {
	jh := make(JsonHelper)
	if resp == nil || resp.Body == nil {
		return jh, fmt.Errorf("No response or response body to read")
	}
	defer resp.Body.Close()
	respBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if len(respBytes) == 0 {
		return jh, fmt.Errorf("No data in response")
	}
	if err := json.Unmarshal(respBytes, &jh); err != nil {
		return jh, err
	}
	return jh, nil
}

func jsonList(v interface{}) []interface{} {
	switch v.(type) {
	case []interface{}:
		return v.([]interface{})
	}
	return nil
}

func jsonEntry(name string, v interface{}) (interface{}, bool) {
	switch val := v.(type) {
	case map[string]interface{}:
		if root, ok := val[name]; ok {
			return root, true
		} else {
			return nil, false
		}
	case JsonHelper:
		return v.(JsonHelper).Get(name), true
	case []interface{}:
		return v, true
	default:
		Debug("no type? ", name, " ", v)
		return nil, false
	}
}

// Get the key (or keypath) value as interface, mostly used
// internally through String, etc methods
//
//    jh.Get("name.subname")
//    jh.Get("name/subname")
//    jh.Get("name.arrayname[1]")
//    jh.Get("name.arrayname[]")
func (j JsonHelper) Get(n string) interface{} {
	var parts []string
	if strings.Contains(n, "/") {
		parts = strings.Split(n, "/")
		if strings.HasPrefix(n, "/") && len(parts) > 0 {
			parts = parts[1:]
		}
	} else {
		parts = strings.Split(n, ".")
	}
	var root interface{}
	var err error
	var ok, isList, listEntry bool
	var ln, st, idx int
	for ict, name := range parts {
		isList = strings.HasSuffix(name, "[]")
		listEntry = strings.HasSuffix(name, "]") && !isList
		ln, idx = len(name), -1
		if isList || listEntry {
			st = strings.Index(name, "[")
			idx, err = strconv.Atoi(name[st+1 : ln-1])
			name = name[:st]
		}
		if ict == 0 {
			root, ok = j[name]
		} else {
			root, ok = jsonEntry(name, root)
		}
		//Debug(isList, listEntry, " ", name, " ", root, " ", ok, err)
		if !ok {
			if len(parts) > 0 {
				// lets ensure the actual json-value doesn't have period in key
				root, ok = j[n]
				if !ok {
					return nil
				} else {
					//Warnf("returning root %T %#v", root, root)
					return root
				}
			} else {
				return nil
			}

		}
		if isList {
			return jsonList(root)
		} else if listEntry && err == nil {
			if lst := jsonList(root); lst != nil && len(lst) > idx {
				root = lst[idx]
			} else {
				return nil
			}
		}

	}
	return root
}

// Get a Helper from a string path
func (j JsonHelper) Helper(n string) JsonHelper {
	v := j.Get(n)
	if v == nil {
		return nil
	}
	switch vt := v.(type) {
	case map[string]interface{}:
		cn := JsonHelper{}
		for n, val := range vt {
			cn[n] = val
		}
		return cn
	case map[string]string:
		cn := JsonHelper{}
		for n, val := range vt {
			cn[n] = val
		}
		return cn
	case JsonHelper:
		return vt
	default:
		//Infof("wrong type: %T", v)
	}
	return nil
}

// Get list of Helpers at given name.  Trys to coerce into
// proper Helper type
func (j JsonHelper) Helpers(n string) []JsonHelper {
	v := j.Get(n)
	if v == nil {
		return nil
	}
	switch val := v.(type) {
	case []map[string]interface{}:
		hl := make([]JsonHelper, 0)
		for _, mapVal := range val {
			hl = append(hl, mapVal)
		}
		return hl
	case []interface{}:
		jhl := make([]JsonHelper, 0)
		for _, item := range val {
			if jh, ok := item.(map[string]interface{}); ok {
				jhl = append(jhl, jh)
			}
		}
		return jhl
	}

	return nil
}

// Gets slice of interface{}
func (j JsonHelper) List(n string) []interface{} {
	v := j.Get(n)
	switch val := v.(type) {
	case []string:
		il := make([]interface{}, len(val))
		for i, val := range val {
			il[i] = val
		}
		return il
	case []interface{}:
		return val
	}
	return nil
}

func (j JsonHelper) String(n string) string {
	if v := j.Get(n); v != nil {
		val, _ := CoerceString(v)
		return val
	}
	return ""
}
func (j JsonHelper) Strings(n string) []string {
	if v := j.Get(n); v != nil {
		//Debugf("Strings(%s) =>  %T %#v", n, v, v)
		switch val := v.(type) {
		case string:
			return strings.Split(val, ",")
		case []string:
			//Debug("type []string")
			return val
		case []interface{}:
			//Debug("Kind = []interface{} n=", n, "  v=", v)
			sva := make([]string, 0)
			for _, av := range val {
				switch aval := av.(type) {
				case string:
					sva = append(sva, aval)
				default:
					//Warnf("Kind ? %T v=%v", aval, aval)
				}
			}
			return sva
		default:
			return []string{j.String(n)}
		}
	}
	return nil
}
func (j JsonHelper) Ints(n string) []int {
	v := j.Get(n)
	if v == nil {
		return nil
	}
	if sl, isSlice := v.([]interface{}); isSlice {
		iva := make([]int, 0)
		for _, av := range sl {
			avAsInt, ok := valToInt(av)
			if ok {
				iva = append(iva, avAsInt)
			}
		}
		return iva
	}
	return nil
}
func (j JsonHelper) StringSafe(n string) (string, bool) {
	v := j.Get(n)
	if v != nil {
		if s, ok := v.(string); ok {
			return s, ok
		}
	}
	return "", false
}

func (j JsonHelper) Int(n string) int {
	i, ok := j.IntSafe(n)
	if !ok {
		return -1
	}
	return i
}

func (j JsonHelper) IntSafe(n string) (int, bool) {
	v := j.Get(n)
	return valToInt(v)
}

func (j JsonHelper) Int64(n string) int64 {
	i64, ok := j.Int64Safe(n)
	if !ok {
		return -1
	}
	return i64
}

func (j JsonHelper) Int64Safe(n string) (int64, bool) {
	v := j.Get(n)
	return valToInt64(v)
}

func (j JsonHelper) Float64(n string) float64 {
	v := j.Get(n)
	f64, _ := CoerceFloat(v)
	return f64
}

func (j JsonHelper) Float64Safe(n string) (float64, bool) {
	v := j.Get(n)
	if v == nil {
		return math.NaN(), false
	}
	fv, err := CoerceFloat(v)
	if err != nil {
		return math.NaN(), false
	}
	return fv, true
}

func (j JsonHelper) Uint64(n string) uint64 {
	v := j.Get(n)
	if v != nil {
		return CoerceUintShort(v)
	}
	return 0
}

func (j JsonHelper) Uint64Safe(n string) (uint64, bool) {
	v := j.Get(n)
	if v != nil {
		if uv, err := CoerceUint(v); err == nil {
			return uv, true
		}
	}
	return 0, false
}

func (j JsonHelper) BoolSafe(n string) (val bool, ok bool) {
	v := j.Get(n)
	if v != nil {
		switch v.(type) {
		case bool:
			return v.(bool), true
		case string:
			if s := v.(string); len(s) > 0 {
				if b, err := strconv.ParseBool(s); err == nil {
					return b, true
				}
			}
		}
	}
	return false, false
}

func (j JsonHelper) Bool(n string) bool {
	val, ok := j.BoolSafe(n)
	if !ok {
		return false
	}

	return val
}

func (j JsonHelper) Map(n string) map[string]interface{} {
	v := j.Get(n)
	if v == nil {
		return nil
	}
	m, ok := v.(map[string]interface{})
	if !ok {
		return nil
	}
	return m
}

func (j JsonHelper) MapSafe(n string) (map[string]interface{}, bool) {
	v := j.Get(n)
	if v == nil {
		return nil, false
	}
	m, ok := v.(map[string]interface{})
	if !ok {
		return nil, false
	}
	return m, true
}

func (j JsonHelper) PrettyJson() []byte {
	jsonPretty, _ := json.MarshalIndent(j, "  ", "  ")
	return jsonPretty
}
func (j JsonHelper) Keys() []string {
	keys := make([]string, 0)
	for key, _ := range j {
		keys = append(keys, key)
	}
	return keys
}

// The following consts are from http://code.google.com/p/go-bit/ (Apache licensed). It
// lets us figure out how wide go ints are, and determine their max and min values.

// Note the use of << to create an untyped constant.
const bitsPerWord = 32 << uint(^uint(0)>>63)

// Implementation-specific size of int and uint in bits.
const BitsPerWord = bitsPerWord // either 32 or 64

// Implementation-specific integer limit values.
const (
	MaxInt  = 1<<(BitsPerWord-1) - 1 // either 1<<31 - 1 or 1<<63 - 1
	MinInt  = -MaxInt - 1            // either -1 << 31 or -1 << 63
	MaxUint = 1<<BitsPerWord - 1     // either 1<<32 - 1 or 1<<64 - 1
)

func flattenHelper(uv url.Values, jh JsonHelper, pre string) error {
	for k, v := range jh {
		if err := flattenJsonValue(uv, v, pre+k); err != nil {
			return err
		}
	}
	return nil
}
func flattenJsonMap(uv url.Values, jsonMap map[string]interface{}, pre string) error {
	for k, v := range jsonMap {
		if err := flattenJsonValue(uv, v, pre+k); err != nil {
			return err
		}
	}
	return nil
}

func flattenJsonValue(uv url.Values, v interface{}, k string) error {
	// TODO:  all these ints aren't possible are they?
	switch x := v.(type) {
	case []string:
		uv[k] = x
	// case []interface{}:
	// 	sva := make([]string, 0)
	// 	for _, av := range x {
	// 		if err := flattenJsonValue(n, av, k); err != nil {
	// 			return nil
	// 		}
	// 	}
	// 	if len(sva) > 0 {
	// 		uv[k] = sva
	// 	}
	case map[string]bool:
		// what to do?
		Info("not implemented: [string]bool")
	case map[string]interface{}:
		if len(x) > 0 {
			if err := flattenJsonMap(uv, x, k+"."); err != nil {
				return err
			}
		}
	case string:
		uv.Set(k, x)
	case bool:
		if x == true {
			uv.Set(k, "t")
		} else {
			uv.Set(k, "f")
		}
	case int:
		uv.Set(k, strconv.FormatInt(int64(x), 10))
	case int8:
		uv.Set(k, strconv.FormatInt(int64(x), 10))
	case int16:
		uv.Set(k, strconv.FormatInt(int64(x), 10))
	case int32:
		uv.Set(k, strconv.FormatInt(int64(x), 10))
	case int64:
		uv.Set(k, strconv.FormatInt(x, 10))
	case uint:
		uv.Set(k, strconv.FormatUint(uint64(x), 10))
	case uint8:
		uv.Set(k, strconv.FormatUint(uint64(x), 10))
	case uint16:
		uv.Set(k, strconv.FormatUint(uint64(x), 10))
	case uint32:
		uv.Set(k, strconv.FormatUint(uint64(x), 10))
	case uint64:
		uv.Set(k, strconv.FormatUint(x, 10))
	case float32:
		uv.Set(k, strconv.FormatFloat(float64(x), 'f', -1, 64))
	case float64:
		uv.Set(k, strconv.FormatFloat(x, 'f', -1, 64))
	default:
		// what types don't we support?
		//  []interface{}
	}
	return nil
}
