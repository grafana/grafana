import { llm } from '@grafana/llm';

import { GlobalTemplateDataExamples } from '../../TemplateDataExamples';

export const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana notification templates using Go templating syntax.

Template guidelines:
- Use Go templating syntax with {{ }} delimiters
- Start templates with {{ define "templateName" }} and end with {{ end }}
- Use meaningful template names (e.g., "slack.title", "email.body")
- Handle both firing and resolved states
- Use PLAIN TEXT formatting only

Return only the Go template content, no additional text or explanations.`;

// Sets up the AI's behavior and context
export const createSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: SYSTEM_PROMPT_CONTENT,
});

// Contains the actual user request/query with template examples
export const createUserPrompt = (userInput: string): llm.Message => {
  const examples = GlobalTemplateDataExamples.map((item) => ({
    description: item.description,
    template: item.example,
  }));

  const examplesText = `
⛔ FORBIDDEN FUNCTIONS - THESE WILL CAUSE ERRORS:
- {{ add }} - NOT SUPPORTED, causes "function add not defined" error
- {{ sub }} - NOT SUPPORTED
- {{ mul }} - NOT SUPPORTED  
- {{ div }} - NOT SUPPORTED
- {{ printf }} - NOT SUPPORTED
- {{ title }} - NOT SUPPORTED

⛔ FORBIDDEN FIELDS - THESE DO NOT EXIST:
- .Alerts.Normal - DOES NOT EXIST (only .Alerts.Firing and .Alerts.Resolved exist)
- .Alerts.Pending - DOES NOT EXIST
- .Alerts.Warning - DOES NOT EXIST
- Any field not shown in the examples below

🚨 CRITICAL: You can ONLY copy patterns EXACTLY from the examples below. Do NOT modify or add anything.

## Template Examples - COPY THESE PATTERNS EXACTLY

${examples
  .map(
    (example) => `**${example.description}:**
\`\`\`go
${example.template}
\`\`\`
`
  )
  .join('\n')}

---

⚠️ RULES FOR GENERATING TEMPLATES:

1. ✅ COPY EXACTLY from examples above - change only the template name and basic text
2. ❌ DO NOT use {{ add }}, {{ sub }}, {{ mul }}, {{ div }}, {{ printf }}, {{ title }}
3. ❌ DO NOT use any function not shown in the examples 
4. ❌ DO NOT use fields like .Alerts.Normal, .Alerts.Pending, .Alerts.Warning (they don't exist)
5. ✅ Use only existing fields: .Alerts.Firing, .Alerts.Resolved (as shown in examples)
6. ✅ Use only allowed functions: {{ range }}, {{ if }}, {{ else }}, {{ end }}, {{ len }}, {{ eq }}, {{ gt }}, {{ toUpper }}, {{ join }}

USER REQUEST: ${userInput}

Generate your template by copying patterns from the examples above. Do NOT use {{ add }} or any forbidden functions. Do NOT use .Alerts.Normal or any non-existent fields.`;

  return {
    role: 'user',
    content: examplesText,
  };
};
