package resources

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitiseKubeName(t *testing.T) {
	for _, tc := range []struct{ Name, Input, Expected string }{
		{"Valid Kubernetes name", "a-b.123.-c", "a-b.123.-c"},
		{"Capital letters lowercase", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"},
		{"Trailing hyphen removed", "abc-", "abc"},
		{"Trailing dot removed", "abc.", "abc"},
		{"Leading hyphen removed", "-abc", "abc"},
		{"Leading dot removed", ".abc", "abc"},
		{"Double hyphen simplified", "ab--c", "ab-c"},
		{"Five hyphens simplified", "ab-----c", "ab-c"},
		{"Underscore converted", "ab_c", "ab-c"},
		{"Slash converted", "ab/c", "ab-c"},
		{"Stops at 40 characters", strings.Repeat("a", 300), strings.Repeat("a", 40)},
	} {
		t.Run(tc.Name, func(t *testing.T) {
			assert.Equal(t, tc.Expected, sanitiseKubeName(tc.Input))
		})
	}
}

func TestAppendHashSuffix(t *testing.T) {
	t.Run("hash key is part of hash", func(t *testing.T) {
		keyA := appendHashSuffix("A", "unit-test")("test")
		keyB := appendHashSuffix("B", "unit-test")("test")
		assert.NotEqual(t, keyA, keyB, "hash key is not part of hash")
	})
	t.Run("repository name is part of hash", func(t *testing.T) {
		repoA := appendHashSuffix("unit-test", "A")("test")
		repoB := appendHashSuffix("unit-test", "B")("test")
		assert.NotEqual(t, repoA, repoB, "repo name is not part of hash")
	})
	t.Run("is deterministic", func(t *testing.T) {
		hasher := appendHashSuffix("unit", "test")
		assert.Equal(t, hasher("a"), hasher("a"))
		_ = hasher("b")                           // Assume it isn't deterministic: this would likely modify a hasher state
		assert.Equal(t, hasher("a"), hasher("a")) // alas, it is deterministic!
	})

	// These are covered by the tests above, so we can just use static values from now on
	const repoName = "repository"
	const hashKey = "key"
	hasher := appendHashSuffix(hashKey, repoName)

	for _, tc := range []struct{ Name, Input, Expected string }{
		{"Simple, short prefix", "test", "test-ae2h65vh3ygoxmprmnludpyhhpr3d-5iosy"},
		{"Suffix requiring cutting hash to min", strings.Repeat("test", 200), "testtesttesttesttesttesttesttes-8dogmh7b"},
		{"Suffix requiring partially cutting hash", strings.Repeat("test", 7), "testtesttesttesttesttesttest-icauzj-i5j5"},
	} {
		t.Run(tc.Name, func(t *testing.T) {
			hashed := hasher(tc.Input)
			assert.Equal(t, tc.Expected, hashed, "hashed value must be as expected")

			// These exist both because they're helpful to understand how something isn't equal above, and for programmer errors. (e.g. what if I manually input a 41 char expected value? or one with too few hash chars?)
			// We only want 40 characters because UIDs support no more. When we get rid of legacy storage, we can extend the support to 253 character long strings.
			assert.LessOrEqual(t, len(hashed), 40, "string after hashing needs to be <=40 chars long")
			assert.GreaterOrEqual(t, len(strings.SplitAfterN(hashed, "-", 2)[1]), 8, "hash must be at least 8 characters long")
		})
	}
}

func TestParseFolderID(t *testing.T) {
	const repoName = "unit-test" // we have other tests verifying the repo name changes the id

	cases := []struct {
		Description string
		Path        string
		Title       string
		KubeName    string
	}{
		{"Short, simple path", "hello/world", "world", "world-wik-hjayboohlsvzzr2ob3he8cs7ffk0jd"},
		{"Capital letters and punctuation", "Hello, World!", "Hello, World!", "helloworld-sbcnvdmezf0jnvgfhpk5ewaoawbeg"},
		{"Very long name", strings.Repeat("/hello/world", 200), "world", "world-bc9jpbg6ctg-w-pexkul-f1ic-bwer5-3r"},
	}

	for _, c := range cases {
		t.Run(c.Description, func(t *testing.T) {
			id := ParseFolder(c.Path, repoName)
			assert.Equal(t, c.Path, id.Path)
			assert.Equal(t, c.KubeName, id.ID)
			assert.Equal(t, c.Title, id.Title)

			// We only want 40 characters because UIDs support no more. When we get rid of legacy storage, we can extend the support to 253 character long strings.
			assert.LessOrEqual(t, len(id.ID), 40, "ID after hashing needs to be <=40 chars long")
		})
	}
}
