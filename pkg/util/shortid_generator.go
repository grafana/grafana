package util

import (
	"errors"
	"fmt"
	"math/rand"
	"regexp"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/google/uuid"
)

const MaxUIDLength = 40

var uidrand = rand.New(rand.NewSource(time.Now().UnixNano()))
var alphaRunes = []rune("abcdefghijklmnopqrstuvwxyz")
var hexLetters = []rune("abcdef")

var (
	ErrUIDTooLong       = fmt.Errorf("UID is longer than %d symbols", MaxUIDLength)
	ErrUIDFormatInvalid = errors.New("invalid format of UID. Only letters, numbers, '-' and '_' are allowed")
	ErrUIDEmpty         = fmt.Errorf("UID is empty")
)

// We want to protect our number generator as they are not thread safe. Not using
// the mutex could result in panics in certain cases where UIDs would be generated
// at the same time.
var mtx sync.Mutex

// Legacy UID pattern
var validUIDCharPattern = `a-zA-Z0-9\-\_`
var validUIDPattern = regexp.MustCompile(`^[` + validUIDCharPattern + `]*$`).MatchString

// IsValidShortUID checks if short unique identifier contains valid characters
// NOTE: future Grafana UIDs will need conform to https://github.com/kubernetes/apimachinery/blob/master/pkg/util/validation/validation.go#L43
func IsValidShortUID(uid string) bool {
	return validUIDPattern(uid)
}

// IsShortUIDTooLong checks if short unique identifier is too long
func IsShortUIDTooLong(uid string) bool {
	return len(uid) > MaxUIDLength
}

var node *snowflake.Node

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
		uid, err := uuid.NewRandom()
		if err != nil {
			// This should never happen... but this seems better than a panic
			for i := range uid {
				uid[i] = byte(uidrand.Intn(255))
			}
		}
		uuid := uid.String()
		if rune(uuid[0]) < rune('a') {
			uuid = string(hexLetters[uidrand.Intn(len(hexLetters))]) + uuid[1:]
		}
		return uuid
	}

	return string(hexLetters[uidrand.Intn(len(hexLetters))]) + // start with a letter
		node.Generate().Base36() +
		string(hexLetters[uidrand.Intn(len(hexLetters))]) // a bit more entropy
}

// ValidateUID checks the format and length of the string and returns error if it does not pass the condition
func ValidateUID(uid string) error {
	if len(uid) == 0 {
		return ErrUIDEmpty
	}
	if IsShortUIDTooLong(uid) {
		return ErrUIDTooLong
	}
	if !IsValidShortUID(uid) {
		return ErrUIDFormatInvalid
	}
	return nil
}
