import { type ChatContextItem, type OpenAssistantProps, createAssistantContextItem } from '@grafana/assistant';
import { t } from '@grafana/i18n';

import { type Spec as NotebookSpec } from '../types';
import { notebookShareUrl } from '../urls';

import { notebookToMarkdown } from './notebookToMarkdown';

const NOTEBOOK_PAGE_ORIGIN = 'grafana/notebook-create-page';

/**
 * What the Assistant opens with. The Markdown lets it plan from the notebook straight away; the path
 * lets the Skill read the full spec, which the Markdown flattens, through its notebook tools.
 */
export function notebookPageContext(uid: string, spec: NotebookSpec): ChatContextItem[] {
  const url = notebookShareUrl(uid);

  return [
    createAssistantContextItem('structured', {
      title: t('notebooks.create-page.context-title', 'Notebook: {{title}}', { title: spec.title }),
      icon: 'book-open',
      data: {
        kind: 'notebook',
        uid,
        path: `/notebooks/${uid}.nb`,
        url,
        title: spec.title,
        markdown: notebookToMarkdown(spec, { url }),
      },
    }),
  ];
}

/** The two Pages we advertise; the Assistant picks the notebook-story-page Skill from the prompt; each names its format and audience, so the Skill need not ask for them. */
export type NotebookPageKind = 'presentation' | 'exec-summary';

function notebookPagePrompt(kind: NotebookPageKind): string {
  switch (kind) {
    case 'presentation':
      return t(
        'notebooks.create-page.prompt-presentation',
        'Create a presentation Page from this notebook: slides with speaker notes for a meeting.'
      );
    case 'exec-summary':
      return t(
        'notebooks.create-page.prompt-exec-summary',
        'Create an exec summary Page from this notebook for leadership.'
      );
  }
}

/** Sent straight away: the prompt already names the format and audience, and the user confirms the storyboard the Skill proposes before anything is built. */
export function notebookPageAssistantProps(
  uid: string,
  spec: NotebookSpec,
  kind: NotebookPageKind
): OpenAssistantProps {
  return {
    origin: NOTEBOOK_PAGE_ORIGIN,
    mode: 'assistant',
    prompt: notebookPagePrompt(kind),
    context: notebookPageContext(uid, spec),
    autoSend: true,
  };
}
