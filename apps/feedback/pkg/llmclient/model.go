package llmclient

import (
	"fmt"
	"strings"
)

// GitHubClient defines a simple client for interacting with the GitHub API
type LLMClient struct {
	URL              string
	ChatOptions      ChatOptions
	Responsibilities labelMap
	LabelMap         labelMap
}

type ChatOptions struct {
	SelectedModel string  `json:"selectedModel"`
	SystemPrompt  string  `json:"systemPrompt"`
	Temperature   float32 `json:"temperature"`
}

type LLMRequest struct {
	Messages    []LLMMessage `json:"messages"`
	ChatOptions ChatOptions  `json:"chatOptions"`
}

type LLMMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type labelMap map[string]string

func (m labelMap) String() string {
	var sb strings.Builder
	for k, v := range m {
		sb.WriteString(fmt.Sprintf("%s: %s\n", v, k))
	}
	return sb.String()
}
