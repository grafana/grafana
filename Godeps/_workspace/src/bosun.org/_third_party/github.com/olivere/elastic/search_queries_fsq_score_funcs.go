// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"strings"
)

// ScoreFunction is used in combination with the Function Score Query.
type ScoreFunction interface {
	Name() string
	Source() interface{}
}

// -- Exponential Decay --

type ExponentialDecayFunction struct {
	fieldName string
	origin    interface{}
	scale     interface{}
	decay     *float64
	offset    interface{}
}

func NewExponentialDecayFunction() ExponentialDecayFunction {
	return ExponentialDecayFunction{}
}

func (fn ExponentialDecayFunction) Name() string {
	return "exp"
}

func (fn ExponentialDecayFunction) FieldName(fieldName string) ExponentialDecayFunction {
	fn.fieldName = fieldName
	return fn
}

func (fn ExponentialDecayFunction) Origin(origin interface{}) ExponentialDecayFunction {
	fn.origin = origin
	return fn
}

func (fn ExponentialDecayFunction) Scale(scale interface{}) ExponentialDecayFunction {
	fn.scale = scale
	return fn
}

func (fn ExponentialDecayFunction) Decay(decay float64) ExponentialDecayFunction {
	fn.decay = &decay
	return fn
}

func (fn ExponentialDecayFunction) Offset(offset interface{}) ExponentialDecayFunction {
	fn.offset = offset
	return fn
}

func (fn ExponentialDecayFunction) Source() interface{} {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source[fn.fieldName] = params
	if fn.origin != nil {
		params["origin"] = fn.origin
	}
	params["scale"] = fn.scale
	if fn.decay != nil && *fn.decay > 0 {
		params["decay"] = *fn.decay
	}
	if fn.offset != nil {
		params["offset"] = fn.offset
	}
	return source
}

// -- Gauss Decay --

type GaussDecayFunction struct {
	fieldName string
	origin    interface{}
	scale     interface{}
	decay     *float64
	offset    interface{}
}

func NewGaussDecayFunction() GaussDecayFunction {
	return GaussDecayFunction{}
}

func (fn GaussDecayFunction) Name() string {
	return "gauss"
}

func (fn GaussDecayFunction) FieldName(fieldName string) GaussDecayFunction {
	fn.fieldName = fieldName
	return fn
}

func (fn GaussDecayFunction) Origin(origin interface{}) GaussDecayFunction {
	fn.origin = origin
	return fn
}

func (fn GaussDecayFunction) Scale(scale interface{}) GaussDecayFunction {
	fn.scale = scale
	return fn
}

func (fn GaussDecayFunction) Decay(decay float64) GaussDecayFunction {
	fn.decay = &decay
	return fn
}

func (fn GaussDecayFunction) Offset(offset interface{}) GaussDecayFunction {
	fn.offset = offset
	return fn
}

func (fn GaussDecayFunction) Source() interface{} {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source[fn.fieldName] = params
	if fn.origin != nil {
		params["origin"] = fn.origin
	}
	params["scale"] = fn.scale
	if fn.decay != nil && *fn.decay > 0 {
		params["decay"] = *fn.decay
	}
	if fn.offset != nil {
		params["offset"] = fn.offset
	}
	return source
}

// -- Linear Decay --

type LinearDecayFunction struct {
	fieldName string
	origin    interface{}
	scale     interface{}
	decay     *float64
	offset    interface{}
}

func NewLinearDecayFunction() LinearDecayFunction {
	return LinearDecayFunction{}
}

func (fn LinearDecayFunction) Name() string {
	return "linear"
}

func (fn LinearDecayFunction) FieldName(fieldName string) LinearDecayFunction {
	fn.fieldName = fieldName
	return fn
}

func (fn LinearDecayFunction) Origin(origin interface{}) LinearDecayFunction {
	fn.origin = origin
	return fn
}

func (fn LinearDecayFunction) Scale(scale interface{}) LinearDecayFunction {
	fn.scale = scale
	return fn
}

func (fn LinearDecayFunction) Decay(decay float64) LinearDecayFunction {
	fn.decay = &decay
	return fn
}

func (fn LinearDecayFunction) Offset(offset interface{}) LinearDecayFunction {
	fn.offset = offset
	return fn
}

func (fn LinearDecayFunction) Source() interface{} {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source[fn.fieldName] = params
	if fn.origin != nil {
		params["origin"] = fn.origin
	}
	params["scale"] = fn.scale
	if fn.decay != nil && *fn.decay > 0 {
		params["decay"] = *fn.decay
	}
	if fn.offset != nil {
		params["offset"] = fn.offset
	}
	return source
}

// -- Script --

type ScriptFunction struct {
	script     string
	scriptFile string
	lang       string
	params     map[string]interface{}
}

func NewScriptFunction(script string) ScriptFunction {
	return ScriptFunction{
		script: script,
		params: make(map[string]interface{}),
	}
}

func (fn ScriptFunction) Name() string {
	return "script_score"
}

func (fn ScriptFunction) Script(script string) ScriptFunction {
	fn.script = script
	return fn
}

func (fn ScriptFunction) ScriptFile(scriptFile string) ScriptFunction {
	fn.scriptFile = scriptFile
	return fn
}

func (fn ScriptFunction) Lang(lang string) ScriptFunction {
	fn.lang = lang
	return fn
}

func (fn ScriptFunction) Param(name string, value interface{}) ScriptFunction {
	fn.params[name] = value
	return fn
}

func (fn ScriptFunction) Params(params map[string]interface{}) ScriptFunction {
	fn.params = params
	return fn
}

func (fn ScriptFunction) Source() interface{} {
	source := make(map[string]interface{})
	if fn.script != "" {
		source["script"] = fn.script
	}
	if fn.scriptFile != "" {
		source["script_file"] = fn.scriptFile
	}
	if fn.lang != "" {
		source["lang"] = fn.lang
	}
	if len(fn.params) > 0 {
		source["params"] = fn.params
	}
	return source
}

// -- Factor --

type FactorFunction struct {
	boostFactor *float32
}

func NewFactorFunction() FactorFunction {
	return FactorFunction{}
}

func (fn FactorFunction) Name() string {
	return "boost_factor"
}

func (fn FactorFunction) BoostFactor(boost float32) FactorFunction {
	fn.boostFactor = &boost
	return fn
}

func (fn FactorFunction) Source() interface{} {
	return fn.boostFactor
}

// -- Field value factor --

// FieldValueFactorFunction is a function score function that allows you
// to use a field from a document to influence the score.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-function-score-query.html#_field_value_factor.
type FieldValueFactorFunction struct {
	field    string
	factor   *float64
	modifier string
}

// NewFieldValueFactorFunction creates a new FieldValueFactorFunction.
func NewFieldValueFactorFunction() FieldValueFactorFunction {
	return FieldValueFactorFunction{}
}

// Name of the function score function.
func (fn FieldValueFactorFunction) Name() string {
	return "field_value_factor"
}

// Field is the field to be extracted from the document.
func (fn FieldValueFactorFunction) Field(field string) FieldValueFactorFunction {
	fn.field = field
	return fn
}

// Factor is the (optional) factor to multiply the field with. If you do not
// specify a factor, the default is 1.
func (fn FieldValueFactorFunction) Factor(factor float64) FieldValueFactorFunction {
	fn.factor = &factor
	return fn
}

// Modifier to apply to the field value. It can be one of: none, log, log1p,
// log2p, ln, ln1p, ln2p, square, sqrt, or reciprocal. Defaults to: none.
func (fn FieldValueFactorFunction) Modifier(modifier string) FieldValueFactorFunction {
	fn.modifier = modifier
	return fn
}

// Source returns the JSON to be serialized into the query.
func (fn FieldValueFactorFunction) Source() interface{} {
	source := make(map[string]interface{})
	if fn.field != "" {
		source["field"] = fn.field
	}
	if fn.factor != nil {
		source["factor"] = *fn.factor
	}
	if fn.modifier != "" {
		source["modifier"] = strings.ToLower(fn.modifier)
	}
	return source
}

// -- Random --

type RandomFunction struct {
	seed *int64
}

func NewRandomFunction() RandomFunction {
	return RandomFunction{}
}

func (fn RandomFunction) Name() string {
	return "random_score"
}

func (fn RandomFunction) Seed(seed int64) RandomFunction {
	fn.seed = &seed
	return fn
}

func (fn RandomFunction) Source() interface{} {
	source := make(map[string]interface{})
	if fn.seed != nil {
		source["seed"] = *fn.seed
	}
	return source
}
