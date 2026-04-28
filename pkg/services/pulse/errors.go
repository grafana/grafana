package pulse

import "errors"

var (
	ErrThreadNotFound        = errors.New("pulse thread not found")
	ErrPulseNotFound         = errors.New("pulse not found")
	ErrInvalidResourceKind   = errors.New("invalid resource kind")
	ErrInvalidBody           = errors.New("invalid pulse body")
	ErrEmptyBody             = errors.New("pulse body cannot be empty")
	ErrBodyTooLarge          = errors.New("pulse body exceeds size limit")
	ErrBodyDisallowedNode    = errors.New("pulse body contains a disallowed node type")
	ErrBodyInvalidLink       = errors.New("pulse body contains an unsafe link")
	ErrBodyInvalidMention    = errors.New("pulse body contains an invalid mention")
	ErrParentPulseMismatch   = errors.New("parent pulse does not belong to this thread")
	ErrParentPulseDeleted    = errors.New("cannot reply to a deleted pulse")
	ErrCannotEditNotAuthor   = errors.New("only the original author can edit a pulse")
	ErrCannotDeleteForbidden = errors.New("only the author or an admin can delete a pulse")
	ErrAccessDenied          = errors.New("access denied to this resource")
	ErrPulseAlreadyDeleted   = errors.New("pulse is already deleted")
	ErrThreadResourceMissing = errors.New("resourceKind and resourceUID are required")
)
