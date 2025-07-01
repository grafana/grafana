import { llm } from '@grafana/llm';

import { GlobalTemplateDataExamples } from '../../TemplateDataExamples';

export const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana notification templates using Go templating syntax.

🚨 CRITICAL RESTRICTION: You can ONLY use template functions, syntax, and patterns that are demonstrated in the provided template examples. Do NOT use any functions that do not appear in the examples (like add, sub, mul, div, printf, title, trim, split, etc.).

Available data fields in Grafana templates:
- .Alerts (array of alert objects)
- .CommonAnnotations (shared annotations)
- .CommonLabels (shared labels) 
- .ExternalURL (Grafana external URL)
- .GroupLabels (grouping labels)
- .Status (firing/resolved)
- Each alert has: .Annotations, .Labels, .StartsAt, .EndsAt, .GeneratorURL, .Fingerprint

Template guidelines:
- Use Go templating syntax with {{ }} delimiters
- Start templates with {{ define "templateName" }} and end with {{ end }}
- Use meaningful template names (e.g., "slack.title", "email.body")
- Handle both firing and resolved states
- Use PLAIN TEXT formatting only

IMPORTANT: Study the template examples provided below and copy their patterns exactly. Only use functions, syntax, and operations that you can see working in those examples. Do not invent or add any functions not demonstrated.

When generating your template, base it entirely on the patterns shown in the examples below.

Return only the Go template content, no additional text or explanations.`;

// Sets up the AI's behavior and context
export const createSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: SYSTEM_PROMPT_CONTENT,
});

// Contains the actual user request/query with template examples
export const createUserPrompt = (userInput: string): llm.Message => {
  const templateExamplesData = {
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

  const examplesText = `

## Available Template Examples

${templateExamplesData.examples
  .map(
    (example) => `**${example.description}:**
\`\`\`go
${example.template}
\`\`\`
`
  )
  .join('\n')}

## Data Structure Available in Templates

- **Alerts**: ${templateExamplesData.dataStructure.alerts}
- **CommonAnnotations**: ${templateExamplesData.dataStructure.commonAnnotations}
- **CommonLabels**: ${templateExamplesData.dataStructure.commonLabels}
- **ExternalURL**: ${templateExamplesData.dataStructure.externalURL}
- **GroupLabels**: ${templateExamplesData.dataStructure.groupLabels}
- **Status**: ${templateExamplesData.dataStructure.status}

## Allowed Template Functions
${templateExamplesData.templateFunctions.join(', ')}

---

Please generate a notification template that produces this kind of output: ${userInput}

Create a Go template that would generate a notification with the described format, using appropriate alert data fields and template functions from the examples above.`;

  return {
    role: 'user',
    content: examplesText,
  };
};
