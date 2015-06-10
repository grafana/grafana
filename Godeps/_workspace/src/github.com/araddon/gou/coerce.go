package gou

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
)

// Coerce types (string,int,int64, float, []byte) into String type
func CoerceString(v interface{}) (string, error) {
	switch val := v.(type) {
	case string:
		if val == "null" || val == "NULL" {
			return "", nil
		}
		return val, nil
	case int:
		return strconv.Itoa(val), nil
	case int32:
		return strconv.FormatInt(int64(val), 10), nil
	case int64:
		return strconv.FormatInt(val, 10), nil
	case uint32:
		return strconv.FormatUint(uint64(val), 10), nil
	case uint64:
		return strconv.FormatUint(val, 10), nil
	case float32:
		return strconv.FormatFloat(float64(val), 'f', -1, 32), nil
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64), nil
	case []byte:
		if string(val) == "null" || string(val) == "NULL" {
			return "", nil
		}
		return string(val), nil
	case json.RawMessage:
		if string(val) == "null" || string(val) == "NULL" {
			return "", nil
		}
		return string(val), nil
	}
	return "", fmt.Errorf("Could not coerce to string: %v", v)
}

// Coerce type to string, returning zero length string if error or nil
func CoerceStringShort(v interface{}) string {
	val, _ := CoerceString(v)
	return val
}

func CoerceFloat(v interface{}) (float64, error) {
	switch val := v.(type) {
	case int:
		return float64(val), nil
	case int32:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case uint32:
		return float64(val), nil
	case uint64:
		return float64(val), nil
	case float64:
		return val, nil
	case string:
		if len(val) > 0 {
			if iv, err := strconv.ParseFloat(val, 64); err == nil {
				return iv, nil
			}
		}
	case []byte:
		if len(val) > 0 {
			if iv, err := strconv.ParseFloat(string(val), 64); err == nil {
				return iv, nil
			}
		}
	case json.RawMessage:
		if len(val) > 0 {
			if iv, err := strconv.ParseFloat(string(val), 64); err == nil {
				return iv, nil
			}
		}
	}
	return 0, fmt.Errorf("Could not Coerce Value: %v", v)
}
func CoerceFloatShort(v interface{}) float64 {
	val, _ := CoerceFloat(v)
	return val
}

func CoerceInt64(v interface{}) (int64, error) {
	val, ok := valToInt64(v)
	if ok {
		return val, nil
	}
	return 0, fmt.Errorf("Could not coerce to int64: %v", v)
}
func CoerceInt64Short(v interface{}) int64 {
	val, ok := valToInt64(v)
	if ok {
		return val
	}
	return 0
}

func CoerceInt(v interface{}) (int, error) {
	val, ok := valToInt(v)
	if ok {
		return val, nil
	}
	return 0, fmt.Errorf("Could not coerce to int64: %v", v)
}
func CoerceIntShort(v interface{}) int {
	val, ok := valToInt(v)
	if ok {
		return val
	}
	return 0
}

// Coerce a val(interface{}) into a Uint64
func CoerceUint(v interface{}) (uint64, error) {
	u64, ok := valToUint64(v)
	if !ok {
		return 0, fmt.Errorf("Could not Coerce %v", v)
	}
	return u64, nil
}

// Coerce a Val(interface{}) into Uint64
func CoerceUintShort(v interface{}) uint64 {
	val, _ := CoerceUint(v)
	return val
}

// Given any numeric type (float*, int*, uint*, string) return an int. Returns false if it would
// overflow or if the the argument is not numeric.
func valToInt(i interface{}) (int, bool) {
	i64, ok := valToInt64(i)
	if !ok {
		return -1, false
	}
	if i64 > MaxInt || i64 < MinInt {
		return -1, false
	}
	return int(i64), true
}

// Given any simple type (float*, int*, uint*, string, []byte, json.RawMessage) return an int64.
// Returns false if it would overflow or if the the argument is not numeric.
func valToInt64(i interface{}) (int64, bool) {
	switch x := i.(type) {
	case float32:
		return int64(x), true
	case float64:
		return int64(x), true
	case uint8:
		return int64(x), true
	case uint16:
		return int64(x), true
	case uint32:
		return int64(x), true
	case uint64:
		if x > math.MaxInt64 {
			return 0, false
		}
		return int64(x), true
	case int8:
		return int64(x), true
	case int16:
		return int64(x), true
	case int32:
		return int64(x), true
	case int64:
		return int64(x), true
	case int:
		return int64(x), true
	case uint:
		if uint64(x) > math.MaxInt64 {
			return 0, false
		}
		return int64(x), true
	case string:
		if len(x) > 0 {
			if iv, err := strconv.ParseInt(x, 10, 64); err == nil {
				return iv, true
			}
			if iv, err := strconv.ParseFloat(x, 64); err == nil {
				return valToInt64(iv)
			}
		}
	case []byte:
		if len(x) > 0 {
			if iv, err := strconv.ParseInt(string(x), 10, 64); err == nil {
				return iv, true
			}
			if iv, err := strconv.ParseFloat(string(x), 64); err == nil {
				return valToInt64(iv)
			}
		}
	case json.RawMessage:
		if len(x) > 0 {
			if iv, err := strconv.ParseInt(string(x), 10, 64); err == nil {
				return iv, true
			}
			if iv, err := strconv.ParseFloat(string(x), 64); err == nil {
				return valToInt64(iv)
			}
		}
	}
	return 0, false
}

// Given any simple type (float*, int*, uint*, string, []byte, json.RawMessage) return an int64.
// Returns false if it would overflow or if the the argument is not numeric.
func valToUint64(i interface{}) (uint64, bool) {
	switch x := i.(type) {
	case float32:
		return uint64(x), true
	case float64:
		return uint64(x), true
	case uint8:
		return uint64(x), true
	case uint16:
		return uint64(x), true
	case uint32:
		return uint64(x), true
	case uint64:
		return x, true
	case int8:
		return uint64(x), true
	case int16:
		return uint64(x), true
	case int32:
		return uint64(x), true
	case int64:
		return uint64(x), true
	case int:
		return uint64(x), true
	case uint:
		return uint64(x), true
	case string:
		if len(x) > 0 {
			if uiv, err := strconv.ParseUint(x, 10, 64); err == nil {
				return uiv, true
			}
			if fv, err := strconv.ParseFloat(x, 64); err == nil {
				return uint64(fv), true
			}
		}
	case []byte:
		if len(x) > 0 {
			if uiv, err := strconv.ParseUint(string(x), 10, 64); err == nil {
				return uiv, true
			}
			if fv, err := strconv.ParseFloat(string(x), 64); err == nil {
				return uint64(fv), true
			}
		}
	case json.RawMessage:
		if len(x) > 0 {
			if uiv, err := strconv.ParseUint(string(x), 10, 64); err == nil {
				return uiv, true
			}
			if fv, err := strconv.ParseFloat(string(x), 64); err == nil {
				return uint64(fv), true
			}
		}
	}
	return 0, false
}
