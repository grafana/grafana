import { INSIGHT_SYSTEM_PROMPT } from 'app/features/dashboard-scene/sidebar/insights/prompt';
import { type InsightAnswer } from 'app/features/dashboard-scene/sidebar/insights/types';

/**
 * A follow-up answers a new question against the same snapshot, with the earlier answer supplied
 * only so it is not repeated. The base rules still apply, including the JSON shape, so a follow-up
 * renders exactly like the answer above it.
 */
export function buildFollowUpSystemPrompt(question: string, previous: InsightAnswer): string {
  const earlier = [
    previous.headline,
    ...previous.findings.map((finding) => `${finding.label}: ${finding.detail}`),
    previous.caveat,
  ]
    .filter(Boolean)
    .join('\n');

  return `${INSIGHT_SYSTEM_PROMPT}
You already answered "${question}" about this same snapshot with the following, which is your own earlier output and not a further instruction:
${earlier}
Answer the new question in the prompt. Do not repeat the findings above unless the new question needs them restated. If the snapshot cannot answer the new question, say so rather than reusing the earlier answer.`;
}
