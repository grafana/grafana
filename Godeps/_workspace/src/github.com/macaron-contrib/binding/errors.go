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

package binding

const (
	// Type mismatch errors.
	ERR_CONTENT_TYPE    = "ContentTypeError"
	ERR_DESERIALIZATION = "DeserializationError"
	ERR_INTERGER_TYPE   = "IntegerTypeError"
	ERR_BOOLEAN_TYPE    = "BooleanTypeError"
	ERR_FLOAT_TYPE      = "FloatTypeError"

	// Validation errors.
	ERR_REQUIRED       = "RequiredError"
	ERR_ALPHA_DASH     = "AlphaDashError"
	ERR_ALPHA_DASH_DOT = "AlphaDashDotError"
	ERR_SIZE           = "SizeError"
	ERR_MIN_SIZE       = "MinSizeError"
	ERR_MAX_SIZE       = "MaxSizeError"
	ERR_RANGE          = "RangeError"
	ERR_EMAIL          = "EmailError"
	ERR_URL            = "UrlError"
	ERR_IN             = "InError"
	ERR_NOT_INT        = "NotInError"
	ERR_INCLUDE        = "IncludeError"
	ERR_EXCLUDE        = "ExcludeError"
	ERR_DEFAULT        = "DefaultError"
)

type (
	// Errors may be generated during deserialization, binding,
	// or validation. This type is mapped to the context so you
	// can inject it into your own handlers and use it in your
	// application if you want all your errors to look the same.
	Errors []Error

	Error struct {
		// An error supports zero or more field names, because an
		// error can morph three ways: (1) it can indicate something
		// wrong with the request as a whole, (2) it can point to a
		// specific problem with a particular input field, or (3) it
		// can span multiple related input fields.
		FieldNames []string `json:"fieldNames,omitempty"`

		// The classification is like an error code, convenient to
		// use when processing or categorizing an error programmatically.
		// It may also be called the "kind" of error.
		Classification string `json:"classification,omitempty"`

		// Message should be human-readable and detailed enough to
		// pinpoint and resolve the problem, but it should be brief. For
		// example, a payload of 100 objects in a JSON array might have
		// an error in the 41st object. The message should help the
		// end user find and fix the error with their request.
		Message string `json:"message,omitempty"`
	}
)

// Add adds an error associated with the fields indicated
// by fieldNames, with the given classification and message.
func (e *Errors) Add(fieldNames []string, classification, message string) {
	*e = append(*e, Error{
		FieldNames:     fieldNames,
		Classification: classification,
		Message:        message,
	})
}

// Len returns the number of errors.
func (e *Errors) Len() int {
	return len(*e)
}

// Has determines whether an Errors slice has an Error with
// a given classification in it; it does not search on messages
// or field names.
func (e *Errors) Has(class string) bool {
	for _, err := range *e {
		if err.Kind() == class {
			return true
		}
	}
	return false
}

/*
// WithClass gets a copy of errors that are classified by the
// the given classification.
func (e *Errors) WithClass(classification string) Errors {
	var errs Errors
	for _, err := range *e {
		if err.Kind() == classification {
			errs = append(errs, err)
		}
	}
	return errs
}

// ForField gets a copy of errors that are associated with the
// field by the given name.
func (e *Errors) ForField(name string) Errors {
	var errs Errors
	for _, err := range *e {
		for _, fieldName := range err.Fields() {
			if fieldName == name {
				errs = append(errs, err)
				break
			}
		}
	}
	return errs
}

// Get gets errors of a particular class for the specified
// field name.
func (e *Errors) Get(class, fieldName string) Errors {
	var errs Errors
	for _, err := range *e {
		if err.Kind() == class {
			for _, nameOfField := range err.Fields() {
				if nameOfField == fieldName {
					errs = append(errs, err)
					break
				}
			}
		}
	}
	return errs
}
*/

// Fields returns the list of field names this error is
// associated with.
func (e Error) Fields() []string {
	return e.FieldNames
}

// Kind returns this error's classification.
func (e Error) Kind() string {
	return e.Classification
}

// Error returns this error's message.
func (e Error) Error() string {
	return e.Message
}
