package entity

import "time"

// User defined properties
type Entity struct {
	Kind       string     `json:"kind" yaml:"kind"` // Must match file path conventions
	APIVersion string     `json:"apiVersion" yaml:"apiVersion"`
	Properties Properties `json:"properties" yaml:"properties"`

	// Augmented from the storage/entity API
	Metadata *Metadata `json:"meta,omitempty" yaml:"meta,omitempty"`

	// Body {depends on implementation}
}

// User defined properties save in object body
type Properties struct {
	Name        string            `json:"name" yaml:"name"`
	Description string            `json:"description,omitempty" yaml:"description,omitempty"`
	Labels      map[string]string `json:"labels,omitempty" yaml:"labels,omitempty"`
	SecureKeys  []string          `json:"secureKeys,omitempty" yaml:"secureKeys,omitempty"`
}

// System defined properties
type Metadata struct {
	UID       string    `json:"uid" yaml:"uid"`
	UpdatedBy string    `json:"updatedBy" yaml:"updatedBy"` // users who have saved that file
	CreatedAt time.Time `json:"createdAt" yaml:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" yaml:"updatedAt"`
	Version   string    `json:"version,omitempty" yaml:"version,omitempty"` // same as hash? etag? md5
	Hash      string    `json:"hash,omitempty" yaml:"hash,omitempty"`

	Dependencies  []string     // list of GRNs?
	Provinance    []Provinance // where did the entity come from
	AccessControl []string     // what can the request user do with this item
}

// Where did it come from
type Provinance struct {
	When   time.Time `json:"updatedAt" yaml:"updatedAt"`
	Source string
	//...
}
