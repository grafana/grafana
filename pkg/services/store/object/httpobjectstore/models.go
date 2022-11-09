package httpobjectstore

import (
	"encoding/json"
)

type WriteValueWorkflow = string

var (
	WriteValueWorkflow_Save WriteValueWorkflow = "save" // or empty
	WriteValueWorkflow_PR   WriteValueWorkflow = "pr"
	WriteValueWorkflow_Push WriteValueWorkflow = "push"
)

type WriteValueRequest struct {
	UID             string             `json:"uid"`
	Body            json.RawMessage    `json:"body,omitempty"`
	Message         string             `json:"message,omitempty"`
	Title           string             `json:"title,omitempty"`           // For PRs
	Workflow        WriteValueWorkflow `json:"workflow,omitempty"`        // save | pr | push
	PreviousVersion string             `json:"previousVersion,omitempty"` // optimistic locking
}

type WriteValueResponse struct {
	Code    int    `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	URL     string `json:"url,omitempty"`
	Hash    string `json:"hash,omitempty"`
	Branch  string `json:"branch,omitempty"`
	Pending bool   `json:"pending,omitempty"`
	Size    int64  `json:"size,omitempty"`
}

type workflowInfo struct {
	Type        WriteValueWorkflow `json:"value"` // value matches selectable value
	Label       string             `json:"label"`
	Description string             `json:"description,omitempty"`
}
type optionInfo struct {
	Path      string         `json:"path,omitempty"`
	Workflows []workflowInfo `json:"workflows"`
}
