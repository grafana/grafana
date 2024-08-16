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
