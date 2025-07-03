import { llm } from '@grafana/llm';

import { RuleFormValues } from '../../../types/rule-form';
import { Annotation } from '../../../utils/constants';

// Labels-focused system prompt
export const LABELS_SYSTEM_PROMPT_CONTENT = `You are an expert in improving Grafana alert rule labels to make them more effective for categorization, routing, and filtering.

Your role is to enhance existing alert rules by improving their labels:

Guidelines for label improvements:
1. **Categorization Labels**: Add relevant labels (team, severity, service, environment, etc.)
2. **Template Labels**: Use when query labels are insufficient. They can:
   - Group alerts differently for notifications
   - Be used in notification policies to alter contact points
   - Create dynamic severity based on query values
   - Example conditional severity: \`{{ if (gt \\$values.A.Value 90.0) -}}critical{{ else if (gt \\$values.A.Value 80.0) -}}high{{ else -}}low{{- end }}\`

**Important**: 
- Alert instances are uniquely identified by their set of labels
- Avoid displaying query values in labels (creates many instances)
- Labels should be stable identifiers for grouping and routing
- Use conditional logic in labels for dynamic categorization

Important notes:
- Only suggest improvements that add value
- Don't change existing labels unless they need improvement
- Focus on making alerts better categorized and routable
- Use consistent naming conventions for labels
- Ensure severity levels are appropriate (critical, warning, info)
- Add team/service ownership when possible

Response format: Return ONLY a JSON object with labels:
{
  "labels": [
    {"key": "severity", "value": "{{ if (gt \\$values.A.Value 90.0) -}}critical{{ else if (gt \\$values.A.Value 80.0) -}}high{{ else -}}low{{- end }}"},
    {"key": "team", "value": "platform"},
    {"key": "service", "value": "api"}
  ]
}

Do not include any other text or explanation - only the JSON object.`;

// Annotations-focused system prompt
export const ANNOTATIONS_SYSTEM_PROMPT_CONTENT = `You are an expert in improving Grafana alert rule annotations to make them more informative and actionable.

Your role is to enhance existing alert rules by improving their annotations:

Guidelines for annotation improvements:
1. **Standard Annotations** (always present in alert rules):
   - summary: Keep it concise (1-2 sentences), describe what is happening (key must be "${Annotation.summary}")
   - description: Provide detailed explanation, potential causes, and actionable steps (key must be "${Annotation.description}")
   - runbook_url: Add runbook links when relevant (key must be "${Annotation.runbookURL}")

2. **Custom Annotations**: Use any meaningful key name that makes sense for the context (e.g., "troubleshooting_guide", "escalation_contact", "related_metrics")

3. **Template Annotations**: Use for displaying query values and additional context:
   - Use \`{{ \\$value }}\` for the current alert value
   - Use \`{{ \\$labels.instance }}\` for label values from queries
   - Use \`{{ \\$labels.job }}\` for job names from metrics
   - Example: "CPU usage is {{ \\$value }}% on {{ \\$labels.instance }}"

Important notes:
- Only suggest improvements that add value
- Don't change existing annotations unless they need improvement
- Focus on making the alert more actionable and informative
- Standard annotations (${Annotation.summary}, ${Annotation.description}, ${Annotation.runbookURL}) should be improved, not added
- Annotations are safe place for query values and changing data

Response format: Return ONLY a JSON object with annotations:
{
  "annotations": [
    {"key": "${Annotation.summary}", "value": "High CPU usage detected on {{ \\$labels.instance }}"},
    {"key": "${Annotation.description}", "value": "CPU usage is {{ \\$value }}% for more than 5 minutes. Check running processes and consider scaling."},
    {"key": "${Annotation.runbookURL}", "value": "https://wiki.company.com/runbooks/high-cpu"},
    {"key": "escalation_contact", "value": "platform-team@company.com"}
  ]
}

Do not include any other text or explanation - only the JSON object.`;

// Labels-specific system prompt
export const createLabelsSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: LABELS_SYSTEM_PROMPT_CONTENT,
});

// Annotations-specific system prompt
export const createAnnotationsSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: ANNOTATIONS_SYSTEM_PROMPT_CONTENT,
});

// Contains the user request and current alert rule data
export const createUserPrompt = (userInput: string, currentRule: RuleFormValues): llm.Message => {
  const currentRuleContext = `
Current Alert Rule:
- Name: ${currentRule.name || 'Unnamed alert'}
- Type: ${currentRule.type || 'Not specified'}

Current Queries:
${currentRule.queries?.map((q, index) => `Query ${q.refId || index}: ${JSON.stringify(q.model, null, 2)}`).join('\n') || 'No queries defined'}

Current Labels:
${currentRule.labels?.map((l) => `- ${l.key}: ${l.value}`).join('\n') || 'No labels defined'}

Current Annotations:
${currentRule.annotations?.map((a) => `- ${a.key}: ${a.value}`).join('\n') || 'No annotations defined'}

Current Evaluation:
- Evaluate For: ${currentRule.evaluateFor || 'Not specified'}
- No Data State: ${currentRule.noDataState || 'Not specified'}
- Execution Error State: ${currentRule.execErrState || 'Not specified'}

Current Contact Points:
${currentRule.contactPoints?.grafana?.selectedContactPoint ? `- ${currentRule.contactPoints.grafana.selectedContactPoint}` : 'No contact points configured'}
`;

  return {
    role: 'user',
    content: `Please improve the following alert rule based on this request: "${userInput}" and the current alert rule:

${currentRuleContext}

Focus on the specific improvements requested. Provide better labels and annotations that would make this alert more actionable and informative for the operations team.

Consider improving:
- Standard annotations (${Annotation.summary}, ${Annotation.description}, ${Annotation.runbookURL}) - these are always present and should be improved, not added if user request is to improve them
- Clear, concise summary annotation
- Detailed description annotation with troubleshooting steps
- Runbook URL annotation if relevant
- Dynamic severity labels using conditional logic based on query values
- Team ownership labels
- Environment or service labels
- Additional custom annotations if needed (use meaningful key names like "escalation_contact", "troubleshooting_guide", etc.)

Remember:
- Use template labels for grouping and routing (e.g., conditional severity)
- Put query values in annotations, not labels
- Labels should be stable identifiers, not constantly changing values
- Use conditional logic in labels for dynamic categorization

Return only the JSON object with the improvements.`,
  };
};

// Labels-specific user prompt
export const createLabelsUserPrompt = (userInput: string, currentRule: RuleFormValues): llm.Message => {
  const currentRuleContext = `
Current Alert Rule:
- Name: ${currentRule.name || 'Unnamed alert'}
- Type: ${currentRule.type || 'Not specified'}

Current Queries:
${currentRule.queries?.map((q, index) => `Query ${q.refId || index}: ${JSON.stringify(q.model, null, 2)}`).join('\n') || 'No queries defined'}

Current Labels:
${currentRule.labels?.map((l) => `- ${l.key}: ${l.value}`).join('\n') || 'No labels defined'}

Current Evaluation:
- Evaluate For: ${currentRule.evaluateFor || 'Not specified'}
- No Data State: ${currentRule.noDataState || 'Not specified'}
- Execution Error State: ${currentRule.execErrState || 'Not specified'}
`;

  return {
    role: 'user',
    content: `Please improve the labels for the following alert rule based on this request: "${userInput}" and the current alert rule:

${currentRuleContext}

Focus specifically on improving the labels. Consider adding:
- Dynamic severity labels using conditional logic based on query values
- Team ownership labels
- Environment or service labels
- Categorization labels for better routing and grouping

Remember:
- Use template labels for grouping and routing (e.g., conditional severity)
- Labels should be stable identifiers, not constantly changing values
- Use conditional logic in labels for dynamic categorization
- Avoid displaying query values in labels (creates many instances)

Return only the JSON object with the label improvements.`,
  };
};

// Annotations-specific user prompt
export const createAnnotationsUserPrompt = (userInput: string, currentRule: RuleFormValues): llm.Message => {
  const currentRuleContext = `
Current Alert Rule:
- Name: ${currentRule.name || 'Unnamed alert'}
- Type: ${currentRule.type || 'Not specified'}

Current Queries:
${currentRule.queries?.map((q, index) => `Query ${q.refId || index}: ${JSON.stringify(q.model, null, 2)}`).join('\n') || 'No queries defined'}

Current Annotations:
${currentRule.annotations?.map((a) => `- ${a.key}: ${a.value}`).join('\n') || 'No annotations defined'}

Current Evaluation:
- Evaluate For: ${currentRule.evaluateFor || 'Not specified'}
- No Data State: ${currentRule.noDataState || 'Not specified'}
- Execution Error State: ${currentRule.execErrState || 'Not specified'}

Current Contact Points:
${currentRule.contactPoints?.grafana?.selectedContactPoint ? `- ${currentRule.contactPoints.grafana.selectedContactPoint}` : 'No contact points configured'}
`;

  return {
    role: 'user',
    content: `Please improve the annotations for the following alert rule based on this request: "${userInput}" and the current alert rule:

${currentRuleContext}

Focus specifically on improving the annotations. Consider improving:
- Standard annotations (${Annotation.summary}, ${Annotation.description}, ${Annotation.runbookURL}) - these are always present
- Clear, concise summary annotation
- Detailed description annotation with troubleshooting steps
- Runbook URL annotation if relevant
- Additional custom annotations if needed (use meaningful key names like "escalation_contact", "troubleshooting_guide", etc.)

Remember:
- Put query values in annotations (safe place for changing data)
- Use templates like {{ \\$value }} and {{ \\$labels.instance }} for dynamic content
- Standard annotations should be improved, not added

Return only the JSON object with the annotation improvements.`,
  };
};
