package llmclient

import (
	"net/http"
	"text/template"
)

type LLMClient struct {
	URL                  string
	ChatOptions          ChatOptions
	TeamResponsibilities map[string]string
	httpClient           *http.Client
	tmplTeamPrompt       *template.Template
	tmplIssueNamePrompt  *template.Template
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

type LLMTeamPromptTemplate struct {
	TeamResponsibilities map[string]string
	UserFeedback         string
}
