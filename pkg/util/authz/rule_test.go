package authz

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCleanRelativePath(t *testing.T) {
	rules := []AccessRule{
		// {Path: "/", Verb: AccessAdmin, Kind: "*", Who: "Admin"},
		// {Path: "/", Verb: AccessRead, Kind: "*", Who: "GroupA"},
		// {Path: "/", Verb: AccessRead, Kind: "*", Who: "GroupB"},
		// {Path: "/", Verb: AccessManage, Kind: "dash", Who: "GroupC"},
		// {Path: "/", Verb: AccessManage, Kind: "ds", Who: "GroupC"},
		// {Path: "/folder1", Deny: true, Verb: AccessAdmin, Kind: "*", Who: "GroupB"}, // remove access!
		{Path: "/folder1", Verb: AccessRead, Kind: "*", Who: "GroupD"},
		{Path: "/folder1", Verb: AccessManage, Kind: "ds", Who: "GroupD"},
		{Path: "/folder1/sub", Verb: AccessNone, Kind: "*", Who: "GroupD"},
		{Path: "/aaa/bbb/cccc", Verb: AccessManage, Kind: "*", Who: "GroupD"},
		{Path: "/aaa/bbb/dddd", Verb: AccessManage, Kind: "ds", Who: "GroupD"},
	}

	access, err := buildAccessTrie(rules)
	assert.NoError(t, err)

	js, err := json.MarshalIndent(access, "", "  ")
	assert.NoError(t, err)
	fmt.Printf("%s\n", string(js))

	assert.True(t, access.HasAccess("folder1/something", "dash", AccessRead))
	assert.False(t, access.HasAccess("folder1/something", "dash", AccessAdmin))
	assert.True(t, access.HasAccess("folder1/something", "ds", AccessWrite)) // has manage
	assert.False(t, access.HasAccess("unknown/folder/path", "folder", AccessRead))
	assert.True(t, access.HasAccess("aaa/bbb", "folder", AccessRead))
	assert.False(t, access.HasAccess("aaa/file.json", "dash", AccessRead))
	assert.True(t, access.HasAccess("aaa/bbb/dddd/more/more", "ds", AccessRead))
	assert.False(t, access.HasAccess("aaa/bbb/dddd/more/more", "xx", AccessRead))

	for _, r := range rules {
		fmt.Printf("RULE: %+v\n", r)
	}

	assert.Fail(t, "failing so we see output")
}
