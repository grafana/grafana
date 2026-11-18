import { type FormEvent, useId, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';
import { Field, Input, TextArea } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type ScenePrompt } from '../../prompts/types';
import { getPromptLabel, getPromptSelectionId } from '../../prompts/utils';
import { useSidebarInputAutoFocus } from '../../scene/layouts-shared/utils';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { getDashboardSceneFor } from '../../utils/utils';

import { PromptPanelsPicker } from './PromptPanelsPicker';
import { promptActions } from './actions';
import { type PromptsOwner, type PromptsOwnerKind } from './types';

interface PromptEditState extends SceneObjectState {
  ownerRef: SceneObjectRef<PromptsOwner>;
  ownerKind: PromptsOwnerKind;
  promptIndex: number;
}

/**
 * One prompt being edited in the sidebar, like a dashboard link. It isn't part of the scene graph: the
 * prompt lives in its owner's `prompts`, at `promptIndex`.
 */
export class PromptEdit extends SceneObjectBase<PromptEditState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.sidebar.elements.prompt', 'Question'),
      icon: 'ai-sparkle',
      instanceName: this.getName(),
    };
  }

  public useSidebarOptions(isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
    return usePromptOptions.call(this, isNewElement);
  }

  public onDuplicate() {
    duplicatePrompt(this.getOwner(), this.state.ownerKind, this.state.promptIndex);
  }

  public onConfirmDelete() {
    const name = this.getName();
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard-scene.prompt-edit.delete-title', 'Delete question'),
        text: t('dashboard-scene.prompt-edit.delete-text', 'Are you sure you want to delete: {{name}}?', {
          name,
        }),
        yesText: t('dashboard-scene.prompt-edit.delete-confirm', 'Delete question'),
        onConfirm: () => this.onDelete(),
      })
    );
  }

  public onDelete() {
    const owner = this.getOwner();
    const { promptIndex } = this.state;

    if (promptIndex >= 0 && promptIndex < (owner.state.prompts ?? []).length) {
      promptActions.remove({ owner, index: promptIndex });
    }
    getDashboardSceneFor(owner).state.sidebar.selectObject(owner);
  }

  private getOwner(): PromptsOwner {
    return this.state.ownerRef.resolve();
  }

  private getPrompt(): ScenePrompt | undefined {
    return this.getOwner().state.prompts?.[this.state.promptIndex];
  }

  private getName(): string {
    const prompt = this.getPrompt();
    return (prompt && getPromptLabel(prompt)) || t('dashboard.sidebar.prompts.new-prompt', 'New question');
  }
}

function createPromptEdit(owner: PromptsOwner, ownerKind: PromptsOwnerKind, promptIndex: number): PromptEdit {
  return new PromptEdit({
    ownerRef: owner.getRef(),
    ownerKind,
    promptIndex,
    key: getPromptSelectionId(owner, ownerKind, promptIndex),
  });
}

export function openEditPromptPane(owner: PromptsOwner, ownerKind: PromptsOwnerKind, promptIndex: number) {
  const element = createPromptEdit(owner, ownerKind, promptIndex);
  getDashboardSceneFor(owner).state.sidebar.selectObject(element, { force: true, multi: false });
}

/** Adds an empty prompt and opens it, with the prompt field focused. */
export function openAddPromptPane(owner: PromptsOwner, ownerKind: PromptsOwnerKind) {
  const promptIndex = (owner.state.prompts ?? []).length;
  promptActions.add({
    owner,
    prompt: { text: '' },
    addedObject: createPromptEdit(owner, ownerKind, promptIndex),
  });
}

export function duplicatePrompt(owner: PromptsOwner, ownerKind: PromptsOwnerKind, promptIndex: number) {
  const prompts = owner.state.prompts ?? [];
  const prompt = prompts[promptIndex];
  if (!prompt) {
    return;
  }

  // Viewers tell the copy apart by its label. The prompt run stays the same, unless it is the label.
  const copy = prompt.title?.trim()
    ? { ...prompt, title: `${prompt.title} - Copy` }
    : { ...prompt, text: `${prompt.text} - Copy` };
  promptActions.add({
    owner,
    prompt: copy,
    addedObject: createPromptEdit(owner, ownerKind, prompts.length),
  });
  openEditPromptPane(owner, ownerKind, prompts.length);
}

function usePromptOptions(this: PromptEdit, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const promptEdit = this;
  const categoryId = useId();
  const textId = useId();
  const titleId = useId();
  const sourcesId = useId();

  return useMemo(
    () => [
      new OptionsPaneCategoryDescriptor({ title: '', id: categoryId })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            id: textId,
            render: () => <PromptTextInput promptEdit={promptEdit} autoFocus={isNewElement} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            id: titleId,
            render: () => <PromptTitleInput promptEdit={promptEdit} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            id: sourcesId,
            render: () => <PromptSourcesField promptEdit={promptEdit} />,
          })
        ),
    ],
    [categoryId, textId, titleId, sourcesId, promptEdit, isNewElement]
  );
}

const SOURCES_DESCRIPTIONS: Record<PromptsOwnerKind, () => string> = {
  dashboard: () =>
    t(
      'dashboard.sidebar.prompts.sources.description-dashboard',
      'With none picked, the question is answered from every panel on this dashboard.'
    ),
  row: () =>
    t(
      'dashboard.sidebar.prompts.sources.description-row',
      'With none picked, the question is answered from every panel in this row.'
    ),
  tab: () =>
    t(
      'dashboard.sidebar.prompts.sources.description-tab',
      'With none picked, the question is answered from every panel in this tab.'
    ),
};

/** Picks the panels a prompt is answered from. Each change is one undoable edit. */
export function PromptSourcesField({ promptEdit }: { promptEdit: PromptEdit }) {
  const { ownerRef, ownerKind, promptIndex } = promptEdit.useState();
  const owner = ownerRef.resolve();
  const { prompts } = owner.useState();
  const prompt = prompts?.[promptIndex];

  if (!prompt) {
    return null;
  }

  const onChange = (panelIds: number[]) => {
    const { sources: _, ...rest } = prompt;
    promptActions.update({
      owner,
      index: promptIndex,
      previous: prompt,
      next: panelIds.length ? { ...rest, sources: panelIds.map((panelId) => ({ panelId })) } : rest,
    });
  };

  return (
    <Field
      label={t('dashboard.sidebar.prompts.sources.label', 'Source panels')}
      description={SOURCES_DESCRIPTIONS[ownerKind]()}
      noMargin
    >
      <PromptPanelsPicker
        dashboard={getDashboardSceneFor(owner)}
        value={(prompt.sources ?? []).map((source) => source.panelId)}
        onChange={onChange}
      />
    </Field>
  );
}

const PROMPT_DESCRIPTIONS: Record<PromptsOwnerKind, () => string> = {
  dashboard: () => t('dashboard.sidebar.prompts.description-dashboard', 'Viewers can ask it about this dashboard.'),
  row: () => t('dashboard.sidebar.prompts.description-row', 'Viewers can ask it about the panels in this row.'),
  tab: () => t('dashboard.sidebar.prompts.description-tab', 'Viewers can ask it about the panels in this tab.'),
};

type PromptStringProp = 'text' | 'title';

/** `prompt` with `prop` set to `value`. An empty title is left out, so the prompt shows instead. */
function withPromptProp(prompt: ScenePrompt, prop: PromptStringProp, value: string): ScenePrompt {
  if (prop === 'title' && !value) {
    const { title: _, ...rest } = prompt;
    return rest;
  }
  return { ...prompt, [prop]: value };
}

/**
 * Edits one of a prompt's texts: changes it as the author types, and records one undoable change when the field
 * loses focus. Undefined once the prompt is removed.
 */
function usePromptStringProp(promptEdit: PromptEdit, prop: PromptStringProp) {
  const { ownerRef, ownerKind, promptIndex } = promptEdit.useState();
  const owner = ownerRef.resolve();
  const { prompts } = owner.useState();
  const prompt = prompts?.[promptIndex];
  const valueOnFocus = useRef(prompt?.[prop] ?? '');

  if (!prompt) {
    return undefined;
  }

  return {
    ownerKind,
    value: prompt[prop] ?? '',
    onFocus: () => {
      valueOnFocus.current = prompt[prop] ?? '';
    },
    onChange: (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const prompts = [...(owner.state.prompts ?? [])];
      prompts[promptIndex] = withPromptProp(prompt, prop, event.currentTarget.value);
      owner.setState({ prompts });
    },
    onBlur: () => {
      if (valueOnFocus.current !== (prompt[prop] ?? '')) {
        promptActions.update({
          owner,
          index: promptIndex,
          previous: withPromptProp(prompt, prop, valueOnFocus.current),
          next: prompt,
        });
      }
    },
  };
}

/** The prompt that is run. It can run long, since viewers see its title when it has one. */
export function PromptTextInput({ promptEdit, autoFocus }: { promptEdit: PromptEdit; autoFocus?: boolean }) {
  const editing = usePromptStringProp(promptEdit, 'text');
  const ref = useSidebarInputAutoFocus<HTMLTextAreaElement>({ autoFocus });
  const id = useId();

  if (!editing) {
    return null;
  }

  const { ownerKind, ...field } = editing;

  return (
    <Field
      label={t('dashboard.sidebar.prompts.prompt', 'Question')}
      description={PROMPT_DESCRIPTIONS[ownerKind]()}
      noMargin
    >
      <TextArea
        id={id}
        ref={ref}
        rows={3}
        placeholder={t('dashboard.sidebar.prompts.placeholder', 'What changed since the previous period?')}
        {...field}
      />
    </Field>
  );
}

/** A short title viewers see on the dashboard instead of the prompt. */
export function PromptTitleInput({ promptEdit }: { promptEdit: PromptEdit }) {
  const editing = usePromptStringProp(promptEdit, 'title');
  const id = useId();

  if (!editing) {
    return null;
  }

  const { ownerKind: _, ...field } = editing;

  return (
    <Field
      label={t('dashboard.sidebar.prompts.prompt-title', 'Title')}
      description={t(
        'dashboard.sidebar.prompts.prompt-title-description',
        'Viewers see it on the dashboard instead of the question. Leave it empty to show the question.'
      )}
      noMargin
    >
      <Input
        id={id}
        placeholder={t('dashboard.sidebar.prompts.prompt-title-placeholder', 'What changed?')}
        {...field}
      />
    </Field>
  );
}
