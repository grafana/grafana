package v1beta1

import (
	"list"
	"strings"
)

// ExposedSecureValue contains the raw decrypted secure value.
#ExposedSecureValue: string

SecureValueSpec: {
	// Short description that explains the purpose of this SecureValue.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=25
	description: string & strings.MinRunes(1) & strings.MaxRunes(25)

	// The raw value is only valid for write. Read/List will always be empty.
	// There is no support for mixing `value` and `ref`, you can't create a secret in a third-party keeper with a specified `ref`.
	// Minimum and maximum lengths in bytes.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=24576
	// +optional 
	value?: #ExposedSecureValue

	// When using a third-party keeper, the `ref` is used to reference a value inside the remote storage.
	// This should not contain sensitive information.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=1024
	// +optional
	ref?: string & strings.MinRunes(1) & strings.MaxRunes(1024)

	// Name of the keeper, being the actual storage of the secure value.
	// If not specified, the default keeper for the namespace will be used.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	// +optional
	keeper?: string & strings.MinRunes(1) & strings.MaxRunes(253)

	// The Decrypters that are allowed to decrypt this secret.
	// An empty list means no service can decrypt it.
	// +k8s:validation:maxItems=64
	// +k8s:validation:uniqueItems=true
	// +listType=atomic
	// +optional 
	decrypters?: [...string] & list.UniqueItems() & list.MaxItems(64)
}

SecureValueStatus: {
	version: int64 & >=0

	// +optional
	externalID: string
}
