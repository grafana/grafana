package llmclient

import "github.com/grafana/grafana/pkg/setting"

const (
	TEAM_RESPONSIBILITIES_FILE = "apps/feedback/pkg/llmclient/team_responsibilities.csv"
	TEAM_PROMPT_TEMPLATE       = "apps/feedback/pkg/llmclient/template_team_prompt.txt"
	ISSUE_NAME_PROMPT_TEMPLATE = "apps/feedback/pkg/llmclient/template_issue_name_prompt.txt"
)

type LLMClient struct {
	URL                  string
	ChatOptions          ChatOptions
	TeamResponsibilities map[string]string
	cfg                  *setting.Cfg
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
