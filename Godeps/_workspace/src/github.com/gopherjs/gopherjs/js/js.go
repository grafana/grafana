// Package js provides functions for interacting with native JavaScript APIs. Calls to these functions are treated specially by GopherJS and translated directly to their corresponding JavaScript syntax.
//
// Use MakeWrapper to expose methods to JavaScript. When passing values directly, the following type conversions are performed:
//
//  | Go type               | JavaScript type       | Conversions back to interface{} |
//  | --------------------- | --------------------- | ------------------------------- |
//  | bool                  | Boolean               | bool                            |
//  | integers and floats   | Number                | float64                         |
//  | string                | String                | string                          |
//  | []int8                | Int8Array             | []int8                          |
//  | []int16               | Int16Array            | []int16                         |
//  | []int32, []int        | Int32Array            | []int                           |
//  | []uint8               | Uint8Array            | []uint8                         |
//  | []uint16              | Uint16Array           | []uint16                        |
//  | []uint32, []uint      | Uint32Array           | []uint                          |
//  | []float32             | Float32Array          | []float32                       |
//  | []float64             | Float64Array          | []float64                       |
//  | all other slices      | Array                 | []interface{}                   |
//  | arrays                | see slice type        | see slice type                  |
//  | functions             | Function              | func(...interface{}) *js.Object |
//  | time.Time             | Date                  | time.Time                       |
//  | -                     | instanceof Node       | *js.Object                      |
//  | maps, structs         | instanceof Object     | map[string]interface{}          |
//
// Additionally, for a struct containing a *js.Object field, only the content of the field will be passed to JavaScript and vice versa.
package js

// Object is a container for a native JavaScript object. Calls to its methods are treated specially by GopherJS and translated directly to their JavaScript syntax. A nil pointer to Object is equal to JavaScript's "null". Object can not be used as a map key.
type Object struct{ object *Object }

// Get returns the object's property with the given key.
func (o *Object) Get(key string) *Object { return o.object.Get(key) }

// Set assigns the value to the object's property with the given key.
func (o *Object) Set(key string, value interface{}) { o.object.Set(key, value) }

// Delete removes the object's property with the given key.
func (o *Object) Delete(key string) { o.object.Delete(key) }

// Length returns the object's "length" property, converted to int.
func (o *Object) Length() int { return o.object.Length() }

// Index returns the i'th element of an array.
func (o *Object) Index(i int) *Object { return o.object.Index(i) }

// SetIndex sets the i'th element of an array.
func (o *Object) SetIndex(i int, value interface{}) { o.object.SetIndex(i, value) }

// Call calls the object's method with the given name.
func (o *Object) Call(name string, args ...interface{}) *Object { return o.object.Call(name, args...) }

// Invoke calls the object itself. This will fail if it is not a function.
func (o *Object) Invoke(args ...interface{}) *Object { return o.object.Invoke(args...) }

// New creates a new instance of this type object. This will fail if it not a function (constructor).
func (o *Object) New(args ...interface{}) *Object { return o.object.New(args...) }

// Bool returns the object converted to bool according to JavaScript type conversions.
func (o *Object) Bool() bool { return o.object.Bool() }

// String returns the object converted to string according to JavaScript type conversions.
func (o *Object) String() string { return o.object.String() }

// Int returns the object converted to int according to JavaScript type conversions (parseInt).
func (o *Object) Int() int { return o.object.Int() }

// Int64 returns the object converted to int64 according to JavaScript type conversions (parseInt).
func (o *Object) Int64() int64 { return o.object.Int64() }

// Uint64 returns the object converted to uint64 according to JavaScript type conversions (parseInt).
func (o *Object) Uint64() uint64 { return o.object.Uint64() }

// Float returns the object converted to float64 according to JavaScript type conversions (parseFloat).
func (o *Object) Float() float64 { return o.object.Float() }

// Interface returns the object converted to interface{}. See GopherJS' README for details.
func (o *Object) Interface() interface{} { return o.object.Interface() }

// Unsafe returns the object as an uintptr, which can be converted via unsafe.Pointer. Not intended for public use.
func (o *Object) Unsafe() uintptr { return o.object.Unsafe() }

// Error encapsulates JavaScript errors. Those are turned into a Go panic and may be recovered, giving an *Error that holds the JavaScript error object.
type Error struct {
	*Object
}

// Error returns the message of the encapsulated JavaScript error object.
func (err *Error) Error() string {
	return "JavaScript error: " + err.Get("message").String()
}

// Stack returns the stack property of the encapsulated JavaScript error object.
func (err *Error) Stack() string {
	return err.Get("stack").String()
}

// Global gives JavaScript's global object ("window" for browsers and "GLOBAL" for Node.js).
var Global *Object

// Module gives the value of the "module" variable set by Node.js. Hint: Set a module export with 'js.Module.Get("exports").Set("exportName", ...)'.
var Module *Object

// Undefined gives the JavaScript value "undefined".
var Undefined *Object

// Debugger gets compiled to JavaScript's "debugger;" statement.
func Debugger() {}

// InternalObject returns the internal JavaScript object that represents i. Not intended for public use.
func InternalObject(i interface{}) *Object {
	return nil
}

// MakeFunc wraps a function and gives access to the values of JavaScript's "this" and "arguments" keywords.
func MakeFunc(func(this *Object, arguments []*Object) interface{}) *Object {
	return nil
}

// Keys returns the keys of the given JavaScript object.
func Keys(o *Object) []string {
	if o == nil || o == Undefined {
		return nil
	}
	a := Global.Get("Object").Call("keys", o)
	s := make([]string, a.Length())
	for i := 0; i < a.Length(); i++ {
		s[i] = a.Index(i).String()
	}
	return s
}

// MakeWrapper creates a JavaScript object which has wrappers for the exported methods of i. Use explicit getter and setter methods to expose struct fields to JavaScript.
func MakeWrapper(i interface{}) *Object {
	v := InternalObject(i)
	o := Global.Get("Object").New()
	o.Set("__internal_object__", v)
	methods := v.Get("constructor").Get("methods")
	for i := 0; i < methods.Length(); i++ {
		m := methods.Index(i)
		if m.Get("pkg").String() != "" { // not exported
			continue
		}
		o.Set(m.Get("name").String(), func(args ...*Object) *Object {
			return Global.Call("$externalizeFunction", v.Get(m.Get("prop").String()), m.Get("typ"), true).Call("apply", v, args)
		})
	}
	return o
}

// NewArrayBuffer creates a JavaScript ArrayBuffer from a byte slice.
func NewArrayBuffer(b []byte) *Object {
	slice := InternalObject(b)
	offset := slice.Get("$offset").Int()
	length := slice.Get("$length").Int()
	return slice.Get("$array").Get("buffer").Call("slice", offset, offset+length)
}

// M is a simple map type. It is intended as a shorthand for JavaScript objects (before conversion).
type M map[string]interface{}

// S is a simple slice type. It is intended as a shorthand for JavaScript arrays (before conversion).
type S []interface{}

func init() {
	// avoid dead code elimination
	e := Error{}
	_ = e
}
