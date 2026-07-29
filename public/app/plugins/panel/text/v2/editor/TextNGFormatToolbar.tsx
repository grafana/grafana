import { EditorView } from '@codemirror/view';
import { type ReactNode, type RefObject } from 'react';

import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ToolbarButton, ToolbarButtonRow } from '@grafana/ui';

import { TextMode } from '../../../schemas/textng/panelcfg.gen';

import { insertAtCursor, prefixSelectedLines, surroundSelection } from './editorCommands';

const TABLE_SNIPPET = '\n| Column | Column |\n| ------ | ------ |\n| Value  | Value  |\n';

export const FORMAT_TOOLBAR_TEST_ID = 'TextNGEditor-format-toolbar';

interface FormatAction {
  tooltip: string;
  icon?: IconName;
  label?: ReactNode;
  run: (view: EditorView) => void;
}

export interface TextNGFormatToolbarProps {
  mode: TextMode;
  /**
   * Wrapper the CodeMirror editor is mounted into. The editor is created inside
   * the lazily-loaded bundle and does not expose its `EditorView`, so it is
   * looked up from the DOM when an action runs.
   */
  editorContainerRef: RefObject<HTMLDivElement | null>;
}

function getMarkdownActions(): FormatAction[] {
  return [
    {
      tooltip: t('textng.editor.tooltip-heading', 'Heading'),
      label: t('textng.editor.format-heading', 'H'),
      run: (view) => prefixSelectedLines(view, '# '),
    },
    {
      tooltip: t('textng.editor.tooltip-bold', 'Bold'),
      label: <strong>{t('textng.editor.format-bold', 'B')}</strong>,
      run: (view) => surroundSelection(view, '**'),
    },
    {
      tooltip: t('textng.editor.tooltip-italic', 'Italic'),
      label: <em>{t('textng.editor.format-italic', 'I')}</em>,
      run: (view) => surroundSelection(view, '*'),
    },
    {
      tooltip: t('textng.editor.tooltip-link', 'Link'),
      icon: 'link',
      run: (view) => surroundSelection(view, '[', '](https://)'),
    },
    {
      tooltip: t('textng.editor.tooltip-bullet-list', 'Bullet list'),
      icon: 'list-ul',
      run: (view) => prefixSelectedLines(view, '- '),
    },
    {
      tooltip: t('textng.editor.tooltip-numbered-list', 'Numbered list'),
      icon: 'list-ol',
      run: (view) => prefixSelectedLines(view, '1. '),
    },
    {
      tooltip: t('textng.editor.tooltip-checklist', 'Checklist'),
      icon: 'check-square',
      run: (view) => prefixSelectedLines(view, '- [ ] '),
    },
    {
      tooltip: t('textng.editor.tooltip-table', 'Table'),
      icon: 'table',
      run: (view) => insertAtCursor(view, TABLE_SNIPPET),
    },
  ];
}

function getHtmlActions(): FormatAction[] {
  return [
    {
      tooltip: t('textng.editor.tooltip-bold', 'Bold'),
      label: <strong>{t('textng.editor.format-bold', 'B')}</strong>,
      run: (view) => surroundSelection(view, '<b>', '</b>'),
    },
    {
      tooltip: t('textng.editor.tooltip-italic', 'Italic'),
      label: <em>{t('textng.editor.format-italic', 'I')}</em>,
      run: (view) => surroundSelection(view, '<i>', '</i>'),
    },
    {
      tooltip: t('textng.editor.tooltip-link', 'Link'),
      icon: 'link',
      run: (view) => surroundSelection(view, '<a href="https://">', '</a>'),
    },
  ];
}

function getFormatActions(mode: TextMode): FormatAction[] {
  if (mode === TextMode.Code) {
    return [];
  }

  return [
    ...(mode === TextMode.HTML ? getHtmlActions() : getMarkdownActions()),
    {
      tooltip: t('textng.editor.tooltip-insert-variable', 'Insert variable'),
      icon: 'brackets-curly',
      run: (view) => insertAtCursor(view, '${}'),
    },
  ];
}

export function TextNGFormatToolbar({ mode, editorContainerRef }: TextNGFormatToolbarProps) {
  const actions = getFormatActions(mode);

  if (actions.length === 0) {
    return null;
  }

  const runAction = (run: FormatAction['run']) => {
    const container = editorContainerRef.current;
    const view = container && EditorView.findFromDOM(container);
    if (view) {
      run(view);
      // The button took focus on click; typing should continue in the editor.
      view.focus();
    }
  };

  return (
    <ToolbarButtonRow data-testid={FORMAT_TOOLBAR_TEST_ID}>
      {actions.map((action) => (
        <ToolbarButton
          key={action.tooltip}
          icon={action.icon}
          tooltip={action.tooltip}
          onClick={() => runAction(action.run)}
        >
          {action.label}
        </ToolbarButton>
      ))}
    </ToolbarButtonRow>
  );
}
