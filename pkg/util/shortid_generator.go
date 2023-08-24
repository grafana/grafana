package util

import (
	"errors"
	"fmt"
	"math/rand"
	"regexp"
	"sync"
	"time"

	"github.com/google/uuid"
)

const MaxUIDLength = 40

var uidrand = rand.New(rand.NewSource(time.Now().UnixNano()))
var alphaRunes = []rune("abcdefghijklmnopqrstuvwxyz")
var hexLetters = []rune("abcdef")

var (
	ErrUIDTooLong       = fmt.Errorf("UID is longer than %d symbols", MaxUIDLength)
	ErrUIDFormatInvalid = errors.New("invalid format of UID. Only letters, numbers, '-' and '_' are allowed")
)

// We want to protect our number generator as they are not thread safe. Not using
// the mutex could result in panics in certain cases where UIDs would be generated
// at the same time.
var mtx sync.Mutex

// Legacy UID pattern
var validUIDPattern = regexp.MustCompile(`^[a-zA-Z0-9\-\_]*$`).MatchString

// IsValidShortUID checks if short unique identifier contains valid characters
// NOTE: future Grafana UIDs will need conform to https://github.com/kubernetes/apimachinery/blob/master/pkg/util/validation/validation.go#L43
func IsValidShortUID(uid string) bool {
	return validUIDPattern(uid)
}

// IsShortUIDTooLong checks if short unique identifier is too long
func IsShortUIDTooLong(uid string) bool {
	return len(uid) > MaxUIDLength
}

// GenerateShortUID will generate a UUID that can also be a k8s name
// it is guaranteed to have a character as the first letter
// This UID will be a valid k8s name
func GenerateShortUID() string {
	mtx.Lock()
	defer mtx.Unlock()
	uid, err := uuid.NewRandom()
	if err != nil {
		// This should never happen... but this seems better than a panic
		for i := range uid {
			uid[i] = byte(uidrand.Intn(255))
		}
	}
	uuid := uid.String()
	if rune(uuid[0]) < rune('a') {
		return string(hexLetters[uidrand.Intn(len(hexLetters))]) + uuid[1:]
	}
	return uuid
}

// ValidateUID checks the format and length of the string and returns error if it does not pass the condition
func ValidateUID(uid string) error {
	if IsShortUIDTooLong(uid) {
		return ErrUIDTooLong
	}
	if !IsValidShortUID(uid) {
		return ErrUIDFormatInvalid
	}
	return nil
}
