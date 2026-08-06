package rulesync

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReasonOf(t *testing.T) {
	assert.Equal(t, ReasonUnclassified, reasonOf(errors.New("bare")))
	assert.Equal(t, ReasonNotARuler, reasonOf(&SyncError{Reason: ReasonNotARuler, Cause: ErrNotARuler}))
	// Wrapped SyncError is still classified.
	assert.Equal(t, ReasonSave, reasonOf(&SyncError{Reason: ReasonSave, Cause: errors.New("db down")}))
}

func TestSyncError_UnwrapAndMessage(t *testing.T) {
	cause := errors.New("db down")
	e := &SyncError{Reason: ReasonSave, Cause: cause}
	assert.Equal(t, "db down", e.Error())
	assert.ErrorIs(t, e, cause)
	// Nil cause falls back to the reason label.
	assert.Equal(t, "save", (&SyncError{Reason: ReasonSave}).Error())
}
