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

import (
	"mime/multipart"

	"github.com/Unknwon/macaron"
)

// These types are mostly contrived examples, but they're used
// across many test cases. The idea is to cover all the scenarios
// that this binding package might encounter in actual use.
type (
	// For basic test cases with a required field
	Post struct {
		Title   string `form:"title" json:"title" binding:"Required"`
		Content string `form:"content" json:"content"`
	}

	// To be used as a nested struct (with a required field)
	Person struct {
		Name  string `form:"name" json:"name" binding:"Required"`
		Email string `form:"email" json:"email"`
	}

	// For advanced test cases: multiple values, embedded
	// and nested structs, an ignored field, and single
	// and multiple file uploads
	BlogPost struct {
		Post
		Id          int     `binding:"Required"` // JSON not specified here for test coverage
		Ignored     string  `form:"-" json:"-"`
		Ratings     []int   `form:"rating" json:"ratings"`
		Author      Person  `json:"author"`
		Coauthor    *Person `json:"coauthor"`
		HeaderImage *multipart.FileHeader
		Pictures    []*multipart.FileHeader `form:"picture"`
		unexported  string                  `form:"unexported"`
	}

	EmbedPerson struct {
		*Person
	}

	SadForm struct {
		AlphaDash    string   `form:"AlphaDash" binding:"AlphaDash"`
		AlphaDashDot string   `form:"AlphaDashDot" binding:"AlphaDashDot"`
		MinSize      string   `form:"MinSize" binding:"MinSize(5)"`
		MinSizeSlice []string `form:"MinSizeSlice" binding:"MinSize(5)"`
		MaxSize      string   `form:"MaxSize" binding:"MaxSize(1)"`
		MaxSizeSlice []string `form:"MaxSizeSlice" binding:"MaxSize(1)"`
		Range        int      `form:"Range" binding:"Range(1,2)"`
		RangeInvalid int      `form:"RangeInvalid" binding:"Range(1)"`
		Email        string   `binding:"Email"`
		Url          string   `form:"Url" binding:"Url"`
		UrlEmpty     string   `form:"UrlEmpty" binding:"Url"`
		In           string   `form:"In" binding:"Default(0);In(1,2,3)"`
		InInvalid    string   `form:"InInvalid" binding:"In(1,2,3)"`
		NotIn        string   `form:"NotIn" binding:"NotIn(1,2,3)"`
		Include      string   `form:"Include" binding:"Include(a)"`
		Exclude      string   `form:"Exclude" binding:"Exclude(a)"`
	}

	CustomErrorHandle struct {
		Rule `binding:"CustomRule"`
	}

	// The common function signature of the handlers going under test.
	handlerFunc func(interface{}, ...interface{}) macaron.Handler

	// Used for testing mapping an interface to the context
	// If used (withInterface = true in the testCases), a modeler
	// should be mapped to the context as well as BlogPost, meaning
	// you can receive a modeler in your application instead of a
	// concrete BlogPost.
	modeler interface {
		Model() string
	}
)

func (p Post) Validate(ctx *macaron.Context, errs Errors) Errors {
	if len(p.Title) < 10 {
		errs = append(errs, Error{
			FieldNames:     []string{"title"},
			Classification: "LengthError",
			Message:        "Life is too short",
		})
	}
	return errs
}

func (p Post) Model() string {
	return p.Title
}

func (_ CustomErrorHandle) Error(_ *macaron.Context, _ Errors) {}

const (
	testRoute       = "/test"
	formContentType = "application/x-www-form-urlencoded"
)
