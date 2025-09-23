package schema

import (
	"testing"

	"github.com/openfga/language/pkg/go/transformer"
	"github.com/stretchr/testify/assert"
)

func TestEqualModels(t *testing.T) {
	type testCase struct {
		desc     string
		a        string
		b        string
		expected bool
	}

	tests := []testCase{
		{
			desc: "should be equal",
			a: `
model
  schema 1.1

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]

type team
  relations
    define org: [org]
    define admin: [user]
    define member: [user] or org
			`,
			b: `
model
  schema 1.1

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]

type team
  relations
    define org: [org]
    define admin: [user]
    define member: [user] or org
			`,
			expected: true,
		},
		{
			desc: "should not be equal",
			a: `
model
  schema 1.1

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]

type team
  relations
    define org: [org]
    define admin: [user]
    define member: [user] or org
			`,
			b: `
model
  schema 1.1

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]
`,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			modelA, err := transformer.TransformDSLToProto(tt.a)
			assert.NoError(t, err)

			modelB, err := transformer.TransformDSLToProto(tt.b)
			assert.NoError(t, err)

			assert.Equal(t, tt.expected, EqualModels(modelA, modelB))
		})
	}
}

func TestModulesEqualModels(t *testing.T) {
	type testCase struct {
		desc     string
		a        []transformer.ModuleFile
		b        []transformer.ModuleFile
		expected bool
	}

	tests := []testCase{
		{
			desc: "should be equal",
			a: []transformer.ModuleFile{
				{
					Name: "core.fga",
					Contents: `
module core

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]
          `,
				},
				{
					Name: "team.fga",
					Contents: `
module team

type team
  relations
    define org: [org]
    define admin: [user]
    define member: [user] or org
          `,
				},
			},
			b: []transformer.ModuleFile{
				{
					Name: "core.fga",
					Contents: `
module core

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]
          `,
				},
				{
					Name: "team.fga",
					Contents: `
module team

type team
  relations
    define org: [org]
    define admin: [user]
    define member: [user] or org
          `,
				},
			},
			expected: true,
		},
		{
			desc: "should not be equal",
			a: []transformer.ModuleFile{
				{
					Name: "core.fga",
					Contents: `
module core

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]
          `,
				},
				{
					Name: "team.fga",
					Contents: `
module team

type team
  relations
    define org: [org]
    define admin: [user]
    define member: [user] or org
          `,
				},
			},
			b: []transformer.ModuleFile{
				{
					Name: "core.fga",
					Contents: `
module core

type instance

type user

type org
  relations
    define instance: [instance]
    define member: [user]
    define viewer: [user]

type role
  relations
    define org: [org]
    define instance: [instance]
    define assignee: [user, team#member, role#assignee]
          `,
				},
				{
					Name: "folder.fga",
					Contents: `
module folder

type folder
  relations
    define parent: [folder]
    define org: [org]
          `,
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			modelA, err := TransformModulesToModel(tt.a)
			assert.NoError(t, err)

			modelB, err := TransformModulesToModel(tt.b)
			assert.NoError(t, err)

			assert.Equal(t, tt.expected, EqualModels(modelA, modelB))
		})
	}
}
