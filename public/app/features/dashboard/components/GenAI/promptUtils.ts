export function buildGenAIPrompt(userInstruction: string, textInput: string, getContext?: () => string) {
  const parts = [userInstruction];
  const ctx = getContext?.();

  if (ctx) {
    parts.push(`<context>\n${ctx}\n</context>`);
  }

  const trimmed = textInput.trim();
  if (trimmed) {
    parts.push(`User request: ${trimmed}`);
  }

  return parts.join('\n\n');
}

export function buildAutoGenerateSystemPrompt(
  systemPrompt: string | undefined,
  userInstruction: string,
  getContext?: () => string
) {
  if (!systemPrompt) {
    return undefined;
  }

  return `${systemPrompt}\n\n${buildGenAIPrompt(userInstruction, '', getContext)}`;
}
