// Copyright 2014 martini-contrib/binding Authors
// Copyright 2014 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

// Package binding is a middleware that provides request data binding and validation for Macaron.
package binding

import (
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Unknwon/com"
	"github.com/Unknwon/macaron"
)

const _VERSION = "0.1.0"

func Version() string {
	return _VERSION
}

func bind(ctx *macaron.Context, obj interface{}, ifacePtr ...interface{}) {
	contentType := ctx.Req.Header.Get("Content-Type")
	if ctx.Req.Method == "POST" || ctx.Req.Method == "PUT" || len(contentType) > 0 {
		switch {
		case strings.Contains(contentType, "form-urlencoded"):
			ctx.Invoke(Form(obj, ifacePtr...))
		case strings.Contains(contentType, "multipart/form-data"):
			ctx.Invoke(MultipartForm(obj, ifacePtr...))
		case strings.Contains(contentType, "json"):
			ctx.Invoke(Json(obj, ifacePtr...))
		default:
			var errors Errors
			if contentType == "" {
				errors.Add([]string{}, ERR_CONTENT_TYPE, "Empty Content-Type")
			} else {
				errors.Add([]string{}, ERR_CONTENT_TYPE, "Unsupported Content-Type")
			}
			ctx.Map(errors)
			ctx.Map(obj) // Map a fake struct so handler won't panic.
		}
	} else {
		ctx.Invoke(Form(obj, ifacePtr...))
	}
}

const (
	_JSON_CONTENT_TYPE          = "application/json; charset=utf-8"
	STATUS_UNPROCESSABLE_ENTITY = 422
)

// errorHandler simply counts the number of errors in the
// context and, if more than 0, writes a response with an
// error code and a JSON payload describing the errors.
// The response will have a JSON content-type.
// Middleware remaining on the stack will not even see the request
// if, by this point, there are any errors.
// This is a "default" handler, of sorts, and you are
// welcome to use your own instead. The Bind middleware
// invokes this automatically for convenience.
func errorHandler(errs Errors, rw http.ResponseWriter) {
	if len(errs) > 0 {
		rw.Header().Set("Content-Type", _JSON_CONTENT_TYPE)
		if errs.Has(ERR_DESERIALIZATION) {
			rw.WriteHeader(http.StatusBadRequest)
		} else if errs.Has(ERR_CONTENT_TYPE) {
			rw.WriteHeader(http.StatusUnsupportedMediaType)
		} else {
			rw.WriteHeader(STATUS_UNPROCESSABLE_ENTITY)
		}
		errOutput, _ := json.Marshal(errs)
		rw.Write(errOutput)
		return
	}
}

// Bind wraps up the functionality of the Form and Json middleware
// according to the Content-Type and verb of the request.
// A Content-Type is required for POST and PUT requests.
// Bind invokes the ErrorHandler middleware to bail out if errors
// occurred. If you want to perform your own error handling, use
// Form or Json middleware directly. An interface pointer can
// be added as a second argument in order to map the struct to
// a specific interface.
func Bind(obj interface{}, ifacePtr ...interface{}) macaron.Handler {
	return func(ctx *macaron.Context) {
		bind(ctx, obj, ifacePtr...)
		if handler, ok := obj.(ErrorHandler); ok {
			ctx.Invoke(handler.Error)
		} else {
			ctx.Invoke(errorHandler)
		}
	}
}

// BindIgnErr will do the exactly same thing as Bind but without any
// error handling, which user has freedom to deal with them.
// This allows user take advantages of validation.
func BindIgnErr(obj interface{}, ifacePtr ...interface{}) macaron.Handler {
	return func(ctx *macaron.Context) {
		bind(ctx, obj, ifacePtr...)
	}
}

// Form is middleware to deserialize form-urlencoded data from the request.
// It gets data from the form-urlencoded body, if present, or from the
// query string. It uses the http.Request.ParseForm() method
// to perform deserialization, then reflection is used to map each field
// into the struct with the proper type. Structs with primitive slice types
// (bool, float, int, string) can support deserialization of repeated form
// keys, for example: key=val1&key=val2&key=val3
// An interface pointer can be added as a second argument in order
// to map the struct to a specific interface.
func Form(formStruct interface{}, ifacePtr ...interface{}) macaron.Handler {
	return func(ctx *macaron.Context) {
		var errors Errors

		ensureNotPointer(formStruct)
		formStruct := reflect.New(reflect.TypeOf(formStruct))
		parseErr := ctx.Req.ParseForm()

		// Format validation of the request body or the URL would add considerable overhead,
		// and ParseForm does not complain when URL encoding is off.
		// Because an empty request body or url can also mean absence of all needed values,
		// it is not in all cases a bad request, so let's return 422.
		if parseErr != nil {
			errors.Add([]string{}, ERR_DESERIALIZATION, parseErr.Error())
		}
		mapForm(formStruct, ctx.Req.Form, nil, errors)
		validateAndMap(formStruct, ctx, errors, ifacePtr...)
	}
}

// Maximum amount of memory to use when parsing a multipart form.
// Set this to whatever value you prefer; default is 10 MB.
var MaxMemory = int64(1024 * 1024 * 10)

// MultipartForm works much like Form, except it can parse multipart forms
// and handle file uploads. Like the other deserialization middleware handlers,
// you can pass in an interface to make the interface available for injection
// into other handlers later.
func MultipartForm(formStruct interface{}, ifacePtr ...interface{}) macaron.Handler {
	return func(ctx *macaron.Context) {
		var errors Errors
		ensureNotPointer(formStruct)
		formStruct := reflect.New(reflect.TypeOf(formStruct))
		// This if check is necessary due to https://github.com/martini-contrib/csrf/issues/6
		if ctx.Req.MultipartForm == nil {
			// Workaround for multipart forms returning nil instead of an error
			// when content is not multipart; see https://code.google.com/p/go/issues/detail?id=6334
			if multipartReader, err := ctx.Req.MultipartReader(); err != nil {
				errors.Add([]string{}, ERR_DESERIALIZATION, err.Error())
			} else {
				form, parseErr := multipartReader.ReadForm(MaxMemory)
				if parseErr != nil {
					errors.Add([]string{}, ERR_DESERIALIZATION, parseErr.Error())
				}
				ctx.Req.MultipartForm = form
			}
		}
		mapForm(formStruct, ctx.Req.MultipartForm.Value, ctx.Req.MultipartForm.File, errors)
		validateAndMap(formStruct, ctx, errors, ifacePtr...)
	}
}

// Json is middleware to deserialize a JSON payload from the request
// into the struct that is passed in. The resulting struct is then
// validated, but no error handling is actually performed here.
// An interface pointer can be added as a second argument in order
// to map the struct to a specific interface.
func Json(jsonStruct interface{}, ifacePtr ...interface{}) macaron.Handler {
	return func(ctx *macaron.Context) {
		var errors Errors
		ensureNotPointer(jsonStruct)
		jsonStruct := reflect.New(reflect.TypeOf(jsonStruct))
		if ctx.Req.Request.Body != nil {
			defer ctx.Req.Request.Body.Close()
			err := json.NewDecoder(ctx.Req.Request.Body).Decode(jsonStruct.Interface())
			if err != nil && err != io.EOF {
				errors.Add([]string{}, ERR_DESERIALIZATION, err.Error())
			}
		}
		validateAndMap(jsonStruct, ctx, errors, ifacePtr...)
	}
}

// Validate is middleware to enforce required fields. If the struct
// passed in implements Validator, then the user-defined Validate method
// is executed, and its errors are mapped to the context. This middleware
// performs no error handling: it merely detects errors and maps them.
func Validate(obj interface{}) macaron.Handler {
	return func(ctx *macaron.Context) {
		var errors Errors
		v := reflect.ValueOf(obj)
		k := v.Kind()
		if k == reflect.Interface || k == reflect.Ptr {
			v = v.Elem()
			k = v.Kind()
		}
		if k == reflect.Slice || k == reflect.Array {
			for i := 0; i < v.Len(); i++ {
				e := v.Index(i).Interface()
				errors = validateStruct(errors, e)
				if validator, ok := e.(Validator); ok {
					errors = validator.Validate(ctx, errors)
				}
			}
		} else {
			errors = validateStruct(errors, obj)
			if validator, ok := obj.(Validator); ok {
				errors = validator.Validate(ctx, errors)
			}
		}
		ctx.Map(errors)
	}
}

var (
	alphaDashPattern    = regexp.MustCompile("[^\\d\\w-_]")
	alphaDashDotPattern = regexp.MustCompile("[^\\d\\w-_\\.]")
	emailPattern        = regexp.MustCompile("[\\w!#$%&'*+/=?^_`{|}~-]+(?:\\.[\\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\\w](?:[\\w-]*[\\w])?\\.)+[a-zA-Z0-9](?:[\\w-]*[\\w])?")
	urlPattern          = regexp.MustCompile(`(http|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?`)
)

type (
	// Rule represents a validation rule.
	Rule struct {
		// IsMatch checks if rule matches.
		IsMatch func(string) bool
		// IsValid applies validation rule to condition.
		IsValid func(Errors, string, interface{}) bool
	}
	// RuleMapper represents a validation rule mapper,
	// it allwos users to add custom validation rules.
	RuleMapper []*Rule
)

var ruleMapper RuleMapper

// AddRule adds new validation rule.
func AddRule(r *Rule) {
	ruleMapper = append(ruleMapper, r)
}

func in(fieldValue interface{}, arr string) bool {
	val := fmt.Sprintf("%v", fieldValue)
	vals := strings.Split(arr, ",")
	isIn := false
	for _, v := range vals {
		if v == val {
			isIn = true
			break
		}
	}
	return isIn
}

func parseFormName(raw, actual string) string {
	if len(actual) > 0 {
		return actual
	}
	return nameMapper(raw)
}

// Performs required field checking on a struct
func validateStruct(errors Errors, obj interface{}) Errors {
	typ := reflect.TypeOf(obj)
	val := reflect.ValueOf(obj)

	if typ.Kind() == reflect.Ptr {
		typ = typ.Elem()
		val = val.Elem()
	}

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)

		// Allow ignored fields in the struct
		if field.Tag.Get("form") == "-" || !val.Field(i).CanInterface() {
			continue
		}

		fieldVal := val.Field(i)
		fieldValue := fieldVal.Interface()
		zero := reflect.Zero(field.Type).Interface()

		// Validate nested and embedded structs (if pointer, only do so if not nil)
		if field.Type.Kind() == reflect.Struct ||
			(field.Type.Kind() == reflect.Ptr && !reflect.DeepEqual(zero, fieldValue) &&
				field.Type.Elem().Kind() == reflect.Struct) {
			errors = validateStruct(errors, fieldValue)
		}
		errors = validateField(errors, zero, field, fieldVal, fieldValue)
	}
	return errors
}

func validateField(errors Errors, zero interface{}, field reflect.StructField, fieldVal reflect.Value, fieldValue interface{}) Errors {
	if fieldVal.Kind() == reflect.Slice {
		for i := 0; i < fieldVal.Len(); i++ {
			sliceVal := fieldVal.Index(i)
			if sliceVal.Kind() == reflect.Ptr {
				sliceVal = sliceVal.Elem()
			}

			sliceValue := sliceVal.Interface()
			zero := reflect.Zero(sliceVal.Type()).Interface()
			if sliceVal.Kind() == reflect.Struct ||
				(sliceVal.Kind() == reflect.Ptr && !reflect.DeepEqual(zero, sliceValue) &&
					sliceVal.Elem().Kind() == reflect.Struct) {
				errors = validateStruct(errors, sliceValue)
			}
			/* Apply validation rules to each item in a slice. ISSUE #3
			else {
				errors = validateField(errors, zero, field, sliceVal, sliceValue)
			}*/
		}
	}
VALIDATE_RULES:
	for _, rule := range strings.Split(field.Tag.Get("binding"), ";") {
		if len(rule) == 0 {
			continue
		}

		switch {
		case rule == "OmitEmpty":
			if reflect.DeepEqual(zero, fieldValue) {
				break VALIDATE_RULES
			}
		case rule == "Required":
			if reflect.DeepEqual(zero, fieldValue) {
				errors.Add([]string{field.Name}, ERR_REQUIRED, "Required")
				break VALIDATE_RULES
			}
		case rule == "AlphaDash":
			if alphaDashPattern.MatchString(fmt.Sprintf("%v", fieldValue)) {
				errors.Add([]string{field.Name}, ERR_ALPHA_DASH, "AlphaDash")
				break VALIDATE_RULES
			}
		case rule == "AlphaDashDot":
			if alphaDashDotPattern.MatchString(fmt.Sprintf("%v", fieldValue)) {
				errors.Add([]string{field.Name}, ERR_ALPHA_DASH_DOT, "AlphaDashDot")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "Size("):
			size, _ := strconv.Atoi(rule[5 : len(rule)-1])
			if str, ok := fieldValue.(string); ok && utf8.RuneCountInString(str) != size {
				errors.Add([]string{field.Name}, ERR_SIZE, "Size")
				break VALIDATE_RULES
			}
			v := reflect.ValueOf(fieldValue)
			if v.Kind() == reflect.Slice && v.Len() != size {
				errors.Add([]string{field.Name}, ERR_SIZE, "Size")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "MinSize("):
			min, _ := strconv.Atoi(rule[8 : len(rule)-1])
			if str, ok := fieldValue.(string); ok && utf8.RuneCountInString(str) < min {
				errors.Add([]string{field.Name}, ERR_MIN_SIZE, "MinSize")
				break VALIDATE_RULES
			}
			v := reflect.ValueOf(fieldValue)
			if v.Kind() == reflect.Slice && v.Len() < min {
				errors.Add([]string{field.Name}, ERR_MIN_SIZE, "MinSize")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "MaxSize("):
			max, _ := strconv.Atoi(rule[8 : len(rule)-1])
			if str, ok := fieldValue.(string); ok && utf8.RuneCountInString(str) > max {
				errors.Add([]string{field.Name}, ERR_MAX_SIZE, "MaxSize")
				break VALIDATE_RULES
			}
			v := reflect.ValueOf(fieldValue)
			if v.Kind() == reflect.Slice && v.Len() > max {
				errors.Add([]string{field.Name}, ERR_MAX_SIZE, "MaxSize")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "Range("):
			nums := strings.Split(rule[6:len(rule)-1], ",")
			if len(nums) != 2 {
				break VALIDATE_RULES
			}
			val := com.StrTo(fmt.Sprintf("%v", fieldValue)).MustInt()
			if val < com.StrTo(nums[0]).MustInt() || val > com.StrTo(nums[1]).MustInt() {
				errors.Add([]string{field.Name}, ERR_RANGE, "Range")
				break VALIDATE_RULES
			}
		case rule == "Email":
			if !emailPattern.MatchString(fmt.Sprintf("%v", fieldValue)) {
				errors.Add([]string{field.Name}, ERR_EMAIL, "Email")
				break VALIDATE_RULES
			}
		case rule == "Url":
			str := fmt.Sprintf("%v", fieldValue)
			if len(str) == 0 {
				continue
			} else if !urlPattern.MatchString(str) {
				errors.Add([]string{field.Name}, ERR_URL, "Url")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "In("):
			if !in(fieldValue, rule[3:len(rule)-1]) {
				errors.Add([]string{field.Name}, ERR_IN, "In")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "NotIn("):
			if in(fieldValue, rule[6:len(rule)-1]) {
				errors.Add([]string{field.Name}, ERR_NOT_INT, "NotIn")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "Include("):
			if !strings.Contains(fmt.Sprintf("%v", fieldValue), rule[8:len(rule)-1]) {
				errors.Add([]string{field.Name}, ERR_INCLUDE, "Include")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "Exclude("):
			if strings.Contains(fmt.Sprintf("%v", fieldValue), rule[8:len(rule)-1]) {
				errors.Add([]string{field.Name}, ERR_EXCLUDE, "Exclude")
				break VALIDATE_RULES
			}
		case strings.HasPrefix(rule, "Default("):
			if reflect.DeepEqual(zero, fieldValue) {
				if fieldVal.CanAddr() {
					setWithProperType(field.Type.Kind(), rule[8:len(rule)-1], fieldVal, field.Tag.Get("form"), errors)
				} else {
					errors.Add([]string{field.Name}, ERR_EXCLUDE, "Default")
					break VALIDATE_RULES
				}
			}
		default:
			// Apply custom validation rules.
			for i := range ruleMapper {
				if ruleMapper[i].IsMatch(rule) && !ruleMapper[i].IsValid(errors, field.Name, fieldValue) {
					break VALIDATE_RULES
				}
			}
		}
	}
	return errors
}

// NameMapper represents a form tag name mapper.
type NameMapper func(string) string

var (
	nameMapper = func(field string) string {
		newstr := make([]rune, 0, len(field))
		for i, chr := range field {
			if isUpper := 'A' <= chr && chr <= 'Z'; isUpper {
				if i > 0 {
					newstr = append(newstr, '_')
				}
				chr -= ('A' - 'a')
			}
			newstr = append(newstr, chr)
		}
		return string(newstr)
	}
)

// SetNameMapper sets name mapper.
func SetNameMapper(nm NameMapper) {
	nameMapper = nm
}

// Takes values from the form data and puts them into a struct
func mapForm(formStruct reflect.Value, form map[string][]string,
	formfile map[string][]*multipart.FileHeader, errors Errors) {

	if formStruct.Kind() == reflect.Ptr {
		formStruct = formStruct.Elem()
	}
	typ := formStruct.Type()

	for i := 0; i < typ.NumField(); i++ {
		typeField := typ.Field(i)
		structField := formStruct.Field(i)

		if typeField.Type.Kind() == reflect.Ptr && typeField.Anonymous {
			structField.Set(reflect.New(typeField.Type.Elem()))
			mapForm(structField.Elem(), form, formfile, errors)
			if reflect.DeepEqual(structField.Elem().Interface(), reflect.Zero(structField.Elem().Type()).Interface()) {
				structField.Set(reflect.Zero(structField.Type()))
			}
		} else if typeField.Type.Kind() == reflect.Struct {
			mapForm(structField, form, formfile, errors)
		}

		inputFieldName := parseFormName(typeField.Name, typeField.Tag.Get("form"))
		if len(inputFieldName) == 0 || !structField.CanSet() {
			continue
		}

		inputValue, exists := form[inputFieldName]
		if exists {
			numElems := len(inputValue)
			if structField.Kind() == reflect.Slice && numElems > 0 {
				sliceOf := structField.Type().Elem().Kind()
				slice := reflect.MakeSlice(structField.Type(), numElems, numElems)
				for i := 0; i < numElems; i++ {
					setWithProperType(sliceOf, inputValue[i], slice.Index(i), inputFieldName, errors)
				}
				formStruct.Field(i).Set(slice)
			} else {
				setWithProperType(typeField.Type.Kind(), inputValue[0], structField, inputFieldName, errors)
			}
			continue
		}

		inputFile, exists := formfile[inputFieldName]
		if !exists {
			continue
		}
		fhType := reflect.TypeOf((*multipart.FileHeader)(nil))
		numElems := len(inputFile)
		if structField.Kind() == reflect.Slice && numElems > 0 && structField.Type().Elem() == fhType {
			slice := reflect.MakeSlice(structField.Type(), numElems, numElems)
			for i := 0; i < numElems; i++ {
				slice.Index(i).Set(reflect.ValueOf(inputFile[i]))
			}
			structField.Set(slice)
		} else if structField.Type() == fhType {
			structField.Set(reflect.ValueOf(inputFile[0]))
		}
	}
}

// This sets the value in a struct of an indeterminate type to the
// matching value from the request (via Form middleware) in the
// same type, so that not all deserialized values have to be strings.
// Supported types are string, int, float, and bool.
func setWithProperType(valueKind reflect.Kind, val string, structField reflect.Value, nameInTag string, errors Errors) {
	switch valueKind {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		if val == "" {
			val = "0"
		}
		intVal, err := strconv.ParseInt(val, 10, 64)
		if err != nil {
			errors.Add([]string{nameInTag}, ERR_INTERGER_TYPE, "Value could not be parsed as integer")
		} else {
			structField.SetInt(intVal)
		}
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		if val == "" {
			val = "0"
		}
		uintVal, err := strconv.ParseUint(val, 10, 64)
		if err != nil {
			errors.Add([]string{nameInTag}, ERR_INTERGER_TYPE, "Value could not be parsed as unsigned integer")
		} else {
			structField.SetUint(uintVal)
		}
	case reflect.Bool:
		if val == "on" {
			structField.SetBool(true)
			return
		}

		if val == "" {
			val = "false"
		}
		boolVal, err := strconv.ParseBool(val)
		if err != nil {
			errors.Add([]string{nameInTag}, ERR_BOOLEAN_TYPE, "Value could not be parsed as boolean")
		} else if boolVal {
			structField.SetBool(true)
		}
	case reflect.Float32:
		if val == "" {
			val = "0.0"
		}
		floatVal, err := strconv.ParseFloat(val, 32)
		if err != nil {
			errors.Add([]string{nameInTag}, ERR_FLOAT_TYPE, "Value could not be parsed as 32-bit float")
		} else {
			structField.SetFloat(floatVal)
		}
	case reflect.Float64:
		if val == "" {
			val = "0.0"
		}
		floatVal, err := strconv.ParseFloat(val, 64)
		if err != nil {
			errors.Add([]string{nameInTag}, ERR_FLOAT_TYPE, "Value could not be parsed as 64-bit float")
		} else {
			structField.SetFloat(floatVal)
		}
	case reflect.String:
		structField.SetString(val)
	}
}

// Don't pass in pointers to bind to. Can lead to bugs.
func ensureNotPointer(obj interface{}) {
	if reflect.TypeOf(obj).Kind() == reflect.Ptr {
		panic("Pointers are not accepted as binding models")
	}
}

// Performs validation and combines errors from validation
// with errors from deserialization, then maps both the
// resulting struct and the errors to the context.
func validateAndMap(obj reflect.Value, ctx *macaron.Context, errors Errors, ifacePtr ...interface{}) {
	ctx.Invoke(Validate(obj.Interface()))
	errors = append(errors, getErrors(ctx)...)
	ctx.Map(errors)
	ctx.Map(obj.Elem().Interface())
	if len(ifacePtr) > 0 {
		ctx.MapTo(obj.Elem().Interface(), ifacePtr[0])
	}
}

// getErrors simply gets the errors from the context (it's kind of a chore)
func getErrors(ctx *macaron.Context) Errors {
	return ctx.GetVal(reflect.TypeOf(Errors{})).Interface().(Errors)
}

type (
	// ErrorHandler is the interface that has custom error handling process.
	ErrorHandler interface {
		// Error handles validation errors with custom process.
		Error(*macaron.Context, Errors)
	}

	// Validator is the interface that handles some rudimentary
	// request validation logic so your application doesn't have to.
	Validator interface {
		// Validate validates that the request is OK. It is recommended
		// that validation be limited to checking values for syntax and
		// semantics, enough to know that you can make sense of the request
		// in your application. For example, you might verify that a credit
		// card number matches a valid pattern, but you probably wouldn't
		// perform an actual credit card authorization here.
		Validate(*macaron.Context, Errors) Errors
	}
)
