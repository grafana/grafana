export function buildGenAIPrompt(userInstruction: string, _textInput: string, getContext?: () => string) {
  const parts = [userInstruction];
  const ctx = getContext?.();

  if (ctx) {
    parts.push(`<context>\n${ctx}\n</context>`);
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
