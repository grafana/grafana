import { type PromptsOwner, type PromptsOwnerKind } from '../sidebar/prompts/types';

import { type ScenePrompt } from './types';

/** What viewers see for a prompt on the dashboard: its title, or the prompt itself when it has none. */
export function getPromptLabel(prompt: ScenePrompt): string {
  return prompt.title?.trim() || prompt.text;
}

/**
 * The key of the object that edits a prompt in the sidebar. The prompt's control on the dashboard shows as
 * selected while the sidebar has that key selected.
 */
export function getPromptSelectionId(owner: PromptsOwner, ownerKind: PromptsOwnerKind, promptIndex: number): string {
  return `${owner.state.key ?? ownerKind}-prompt-${promptIndex}`;
}
