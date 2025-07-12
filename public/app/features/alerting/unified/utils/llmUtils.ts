import { llm } from '@grafana/llm';

export const DEFAULT_LLM_MODEL = llm.Model.LARGE; // Use LARGE model for better analysis
export const DEFAULT_LLM_TEMPERATURE = 0.1; // Lower temperature for more consistent results

/**
 * Check if LLM service is enabled and throw error if not
 */
export const ensureLLMEnabled = async (): Promise<void> => {
  const enabled = await llm.enabled();
  if (!enabled) {
    throw new Error('LLM service is not configured or enabled');
  }
};

/**
 * Extract JSON from LLM response by cleaning up markdown formatting
 */
export const extractJsonFromLLMResponse = (response: string): string => {
  // Remove leading/trailing quotes
  let cleaned = response.replace(/^"|"$/g, '').trim();

  // Try to extract JSON from markdown code blocks first (more precise)
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  } else {
    // Fallback: remove markdown code block markers
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  }

  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();

  // Try to find JSON object within the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned.trim();
};

/**
 * Common LLM chat completion with standard error handling
 */
export const callLLM = async (messages: llm.Message[], options?: { temperature?: number }): Promise<string> => {
  await ensureLLMEnabled();

  const response = await llm.chatCompletions({
    model: DEFAULT_LLM_MODEL,
    messages,
    temperature: options?.temperature ?? DEFAULT_LLM_TEMPERATURE,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response content from LLM');
  }

  return content;
};

/**
 * Format LLM error for user display
 */
export const formatLLMError = (error: unknown): string => {
  return `LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
};
