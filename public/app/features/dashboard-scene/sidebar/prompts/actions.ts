import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { edit } from '../../actions/utils/edit';
import { type ScenePrompt } from '../../prompts/types';

import { type PromptsOwner } from './types';

/** Undoable changes to the prompts saved on a dashboard, row, or tab. */
export const promptActions = {
  add({ owner, prompt, addedObject }: { owner: PromptsOwner; prompt: ScenePrompt; addedObject?: SceneObject }) {
    const before = owner.state.prompts;

    edit({
      meta: { actionId: 'prompt.add' },
      description: t('dashboard-scene.prompt-actions.add', 'Add prompt'),
      source: owner,
      addedObject,
      perform: () => owner.setState({ prompts: [...(before ?? []), prompt] }),
      undo: () => owner.setState({ prompts: before }),
    });
  },

  remove({ owner, index }: { owner: PromptsOwner; index: number }) {
    const before = owner.state.prompts;

    edit({
      meta: { actionId: 'prompt.remove' },
      description: t('dashboard-scene.prompt-actions.remove', 'Remove prompt'),
      source: owner,
      perform: () => owner.setState({ prompts: (before ?? []).filter((_, i) => i !== index) }),
      undo: () => owner.setState({ prompts: before }),
    });
  },

  update({
    owner,
    index,
    previous,
    next,
  }: {
    owner: PromptsOwner;
    index: number;
    previous: ScenePrompt;
    next: ScenePrompt;
  }) {
    const replace = (prompt: ScenePrompt) => {
      const prompts = [...(owner.state.prompts ?? [])];
      prompts[index] = prompt;
      owner.setState({ prompts });
    };

    edit({
      meta: { actionId: 'prompt.change' },
      description: t('dashboard-scene.prompt-actions.update', 'Change prompt'),
      source: owner,
      perform: () => replace(next),
      undo: () => replace(previous),
    });
  },

  move({ owner, from, to }: { owner: PromptsOwner; from: number; to: number }) {
    const before = owner.state.prompts ?? [];
    const after = [...before];
    const [moved] = after.splice(from, 1);
    after.splice(to, 0, moved);

    edit({
      meta: { actionId: 'prompt.reorder' },
      description: t('dashboard-scene.prompt-actions.reorder', 'Reorder prompts'),
      source: owner,
      perform: () => owner.setState({ prompts: after }),
      undo: () => owner.setState({ prompts: before }),
    });
  },
};
