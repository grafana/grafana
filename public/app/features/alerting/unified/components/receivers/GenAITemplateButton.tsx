import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { GlobalTemplateDataExamples } from './TemplateDataExamples';

// Tool definition for getting template examples and data
const GET_TEMPLATE_EXAMPLES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_template_examples',
    description:
      'Retrieves available notification template examples and data structure information to help generate template content',
    parameters: {
      type: 'object',
      properties: {
        includeDataStructure: {
          type: 'boolean',
          description: 'Whether to include information about available template data fields',
          default: true,
        },
      },
      required: [],
    },
  },
};

const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana notification templates using Go templating syntax. Based on the user's description of how they want their notification to look, generate the appropriate Go template content.

You have access to tools that can help you:
- get_template_examples: Use this to retrieve available template examples and data structure

Key information about Grafana notification templates:
- Use Go templating syntax with {{ }} delimiters
- Templates can define multiple named templates using {{ define "templateName" }}...{{ end }}
- ONLY use these basic template functions: range, if, else, end, with, printf, len
- Do NOT use: dict, index, slice, title, toUpper, toLower, html, js, urlquery, humanize, or other advanced functions
- Available data fields include:
  - .Alerts (array of alert objects)
  - .CommonAnnotations (shared annotations)
  - .CommonLabels (shared labels) 
  - .ExternalURL (Grafana external URL)
  - .GroupLabels (grouping labels)
  - .Status (firing/resolved)
  - Each alert has: .Annotations, .Labels, .StartsAt, .EndsAt, .GeneratorURL, .Fingerprint

Template structure guidelines:
- Start with {{ define "templateName" }} and end with {{ end }}
- Use meaningful template names that describe the content type (e.g., "slack.title", "email.body")
- Handle both firing and resolved states using simple {{ if eq .Status "firing" }} conditions
- Include relevant alert information like labels, annotations, and timing
- Use PLAIN TEXT formatting only - no HTML tags
- Use simple conditional logic instead of dictionaries or complex functions
- Use .StartsAt and .EndsAt as-is (they're already formatted timestamps)

Valid patterns to use:
- Iterate through alerts: {{ range .Alerts }}...{{ end }}
- Check status: {{ if eq .Status "firing" }}🔥 FIRING{{ else }}✅ RESOLVED{{ end }}
- Access alert fields: {{ .Labels.alertname }}, {{ .Annotations.summary }}
- Simple conditionals: {{ if .Annotations.summary }}Summary: {{ .Annotations.summary }}{{ end }}

AVOID these invalid patterns:
- dict functions: {{ $statusEmoji := dict "firing" "🚨" }} ❌
- index with variables: {{ index $statusEmoji .Status }} ❌  
- HTML tags: <table>, <tr>, <td> ❌
- Complex variable assignments beyond simple ranges ❌
- title, toUpper, toLower functions ❌

When the user describes their desired notification format, generate simple Go template code using only basic conditionals and loops.

Return only the Go template content, no additional text or explanations.`;

export interface GenAITemplateButtonProps {
  onTemplateGenerated: (template: string) => void;
  disabled?: boolean;
  className?: string;
}

export const GenAITemplateButton = ({ onTemplateGenerated, disabled, className }: GenAITemplateButtonProps) => {
  const styles = useStyles2(getStyles);

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tool handler for getting template examples
  const handleGetTemplateExamples = useCallback(async (args: unknown) => {
    try {
      return {
        success: true,
        examples: GlobalTemplateDataExamples.map((item) => ({
          description: item.description,
          template: item.example,
        })),
        dataStructure: {
          alerts: 'Array of alert objects with .Annotations, .Labels, .StartsAt, .EndsAt, .GeneratorURL, .Fingerprint',
          commonAnnotations: 'Shared annotations across all alerts in the group',
          commonLabels: 'Shared labels across all alerts in the group',
          externalURL: 'Grafana external URL',
          groupLabels: 'Labels used for grouping alerts',
          status: 'firing or resolved',
        },
        templateFunctions: ['range', 'if', 'else', 'end', 'with', 'printf', 'len'],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        examples: [],
        dataStructure: {},
        templateFunctions: [],
      };
    }
  }, []);

  // Sets up the AI's behavior and context
  const createSystemPrompt = (): llm.Message => ({
    role: 'system',
    content: SYSTEM_PROMPT_CONTENT,
  });

  // Contains the actual user request/query
  const createUserPrompt = (userInput: string): llm.Message => ({
    role: 'user',
    content: `Generate a notification template that produces this kind of output: ${userInput}

Please create a Go template that would generate a notification with the described format, using appropriate alert data fields and template functions.`,
  });

  // Parse and handle the LLM response
  const handleParsedResponse = useCallback(
    (reply: string) => {
      try {
        // Extract template content from the response - handle code blocks and other formatting
        const cleanedReply = extractTemplateFromLLMResponse(reply);
        onTemplateGenerated(cleanedReply);
        setShowModal(false);
      } catch (error) {
        console.error('Failed to parse generated template:', error);
        setError('Failed to parse the generated template. Please try again.');
      }
    },
    [onTemplateGenerated]
  );

  // Extract template content from LLM response, handling markdown code blocks and other formatting
  const extractTemplateFromLLMResponse = (response: string): string => {
    // Remove leading/trailing quotes (original sanitizeReply behavior)
    let cleaned = response.replace(/^"|"$/g, '');

    // Try to extract from markdown code blocks first
    const codeBlockMatch = cleaned.match(/```(?:go|text|template)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1];
    }

    // Trim whitespace and return
    return cleaned.trim();
  };

  // Handle LLM call with tools
  const handleGenerateWithTools = useCallback(
    async (messages: llm.Message[]) => {
      setIsGenerating(true);
      setError(null);

      try {
        // Check if LLM service is available
        const enabled = await llm.enabled();
        if (!enabled) {
          throw new Error('LLM service is not configured or enabled');
        }

        const response = await llm.chatCompletions({
          model: llm.Model.LARGE, // Use LARGE model for better results
          messages,
          tools: [GET_TEMPLATE_EXAMPLES_TOOL],
          temperature: 0.3,
        });

        const finalMessages = [...messages];

        // Handle tool calls if present
        if (response.choices[0]?.message?.tool_calls) {
          // Add the assistant's response with tool calls
          finalMessages.push({
            role: 'assistant',
            content: response.choices[0].message.content,
            tool_calls: response.choices[0].message.tool_calls,
          });

          // Process each tool call
          for (const toolCall of response.choices[0].message.tool_calls) {
            if (toolCall.function.name === 'get_template_examples') {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await handleGetTemplateExamples(args);

              // Add the tool result to the messages
              finalMessages.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: toolCall.id,
              });
            }
          }

          // Call LLM again with the tool results
          const finalResponse = await llm.chatCompletions({
            model: llm.Model.LARGE, // Use LARGE model for better results
            messages: finalMessages,
            tools: [GET_TEMPLATE_EXAMPLES_TOOL],
            temperature: 0.3,
          });

          // Process the final response
          const finalContent = finalResponse.choices[0]?.message?.content;
          if (finalContent) {
            handleParsedResponse(finalContent);
          }
        } else {
          // No tool calls, process the response directly
          const content = response.choices[0]?.message?.content;
          if (content) {
            handleParsedResponse(content);
          }
        }
      } catch (error) {
        console.error('Failed to generate template with LLM:', error);
        setError(`LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsGenerating(false);
      }
    },
    [handleGetTemplateExamples, handleParsedResponse]
  );

  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }
    const messages: llm.Message[] = [createSystemPrompt(), createUserPrompt(prompt)];
    handleGenerateWithTools(messages);
  };

  const handleClose = () => {
    setShowModal(false);
    setPrompt('');
    setError(null);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon="ai"
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className={className}
        data-testid="generate-template-button"
      >
        <Trans i18nKey="alerting.templates.editor.generate-with-ai">Generate with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.template-form.genai.modal.title', 'Generate Template with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t(
              'alerting.template-form.genai.modal.prompt-label',
              'Describe how you want your notification to look'
            )}
            description={t(
              'alerting.template-form.genai.modal.prompt-description',
              'Describe the format and content you want for your notification. For example: "A Slack message showing alert name, status, and a summary with emoji indicators" or "An email with a table of all firing alerts including their labels and start times".'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.template-form.genai.modal.prompt-placeholder',
                'A Slack message that shows "🔥 ALERT: [AlertName] is firing" with a summary and link to view details...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {error && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.template-form.genai.modal.error">{error}</Trans>
            </div>
          )}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleClose}>
              <Trans i18nKey="common.cancel">Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              icon={isGenerating ? 'spinner' : 'ai'}
            >
              {isGenerating ? (
                <Trans i18nKey="alerting.template-form.genai.modal.generating">Generating...</Trans>
              ) : (
                <Trans i18nKey="alerting.template-form.genai.modal.generate">Generate Template</Trans>
              )}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '50%',
    maxWidth: 600,
  }),
  error: css({
    color: theme.colors.error.text,
    marginBottom: theme.spacing(2),
  }),
});
