package util

import (
	"math/rand"
	"sync"
	"time"
	"uuid"

	"github.com/bwmarrin/snowflake"
)

/*
NOTE: the code below is copied from pkg/util/shortid_generator.go.
That function is part of core grafana, which we don't want to have as a dependency.
*/

// We want to protect our number generator as they are not thread safe. Not using
// the mutex could result in panics in certain cases where UIDs would be generated
// at the same time.
var mtx sync.Mutex

var node *snowflake.Node

var uidrand = rand.New(rand.NewSource(time.Now().UnixNano()))
var hexLetters = []rune("abcdef")

// GenerateShortUID will generate a UUID that can also be a k8s name
// it is guaranteed to have a character as the first letter
// This UID will be a valid k8s name
func GenerateShortUID() string {
	mtx.Lock()
	defer mtx.Unlock()

	if node == nil {
		// ignoring the error happens when input outside 0-1023
		node, _ = snowflake.NewNode(rand.Int63n(1024))
	}

	// Use UUIDs if snowflake failed (should be never)
	if node == nil {
		uuid := uuid.NewV4().String()
		if rune(uuid[0]) < rune('a') {
			uuid = string(hexLetters[uidrand.Intn(len(hexLetters))]) + uuid[1:]
		}
		return uuid
	}

	return string(hexLetters[uidrand.Intn(len(hexLetters))]) + // start with a letter
		node.Generate().Base36() +
		string(hexLetters[uidrand.Intn(len(hexLetters))]) // a bit more entropy
}
