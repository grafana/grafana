import { type EditorView } from '@codemirror/view';
import { type ReactNode, type RefObject } from 'react';

import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Menu, Stack, ToolbarButton } from '@grafana/ui';

import { TextMode } from '../../panelcfg.gen';

import { getEditorView, insertAtCursor, toggleLinePrefix, toggleOrderedList, toggleSurround } from './editorCommands';

const TABLE_SNIPPET = '\n| Column | Column |\n| ------ | ------ |\n| Value  | Value  |\n';

export const FORMAT_TOOLBAR_TEST_ID = 'TextNGEditor-format-toolbar';

interface FormatAction {
  key: string;
  tooltip: string;
  icon?: IconName;
  label?: ReactNode;
  run: (view: EditorView) => void;
}

/** Spread into `toggleSurround`. */
type Markers = readonly [before: string, after?: string];

interface InlineMarkers {
  bold: Markers;
  italic: Markers;
  link: Markers;
}

const MARKDOWN_MARKERS: InlineMarkers = {
  bold: ['**'],
  italic: ['*'],
  link: ['[', '](https://)'],
};

const HTML_MARKERS: InlineMarkers = {
  bold: ['<b>', '</b>'],
  italic: ['<i>', '</i>'],
  link: ['<a href="https://">', '</a>'],
};

function getFormatActions(mode: TextMode): FormatAction[] {
  if (mode === TextMode.Code) {
    return [];
  }

  const isHtml = mode === TextMode.HTML;
  const markers = isHtml ? HTML_MARKERS : MARKDOWN_MARKERS;

  const inlineActions: FormatAction[] = [
    {
      key: 'bold',
      tooltip: t('textng.editor.tooltip-bold', 'Bold'),
      label: <strong>{t('textng.editor.format-bold', 'B')}</strong>,
      run: (view) => toggleSurround(view, ...markers.bold),
    },
    {
      key: 'italic',
      tooltip: t('textng.editor.tooltip-italic', 'Italic'),
      label: <em>{t('textng.editor.format-italic', 'I')}</em>,
      run: (view) => toggleSurround(view, ...markers.italic),
    },
    {
      key: 'link',
      tooltip: t('textng.editor.tooltip-link', 'Link'),
      icon: 'link',
      run: (view) => toggleSurround(view, ...markers.link),
    },
  ];

  const insertVariable: FormatAction = {
    key: 'variable',
    tooltip: t('textng.editor.tooltip-insert-variable', 'Insert variable'),
    icon: 'brackets-curly',
    run: (view) => insertAtCursor(view, '${}'),
  };

  if (isHtml) {
    return [...inlineActions, insertVariable];
  }

  // Markdown only
  return [
    {
      key: 'heading',
      tooltip: t('textng.editor.tooltip-heading', 'Heading'),
      label: t('textng.editor.format-heading', 'H'),
      run: (view) => toggleLinePrefix(view, '# '),
    },
    ...inlineActions,
    {
      key: 'bullet-list',
      tooltip: t('textng.editor.tooltip-bullet-list', 'Bullet list'),
      icon: 'list-ul',
      run: (view) => toggleLinePrefix(view, '- '),
    },
    {
      key: 'numbered-list',
      tooltip: t('textng.editor.tooltip-numbered-list', 'Numbered list'),
      icon: 'list-ol',
      run: (view) => toggleOrderedList(view),
    },
    {
      key: 'checklist',
      tooltip: t('textng.editor.tooltip-checklist', 'Checklist'),
      icon: 'check-square',
      run: (view) => toggleLinePrefix(view, '- [ ] '),
    },
    {
      key: 'table',
      tooltip: t('textng.editor.tooltip-table', 'Table'),
      icon: 'table',
      run: (view) => insertAtCursor(view, TABLE_SNIPPET),
    },
    insertVariable,
  ];
}

export interface TextNGFormatToolbarProps {
  mode: TextMode;
  /** Wrapper the CodeMirror editor is mounted into. */
  editorContainerRef: RefObject<HTMLDivElement | null>;
  /** Collapse into a single menu button, for panels with no room for a row of buttons. */
  compact?: boolean;
}

export function TextNGFormatToolbar({ mode, editorContainerRef, compact }: TextNGFormatToolbarProps) {
  const actions = getFormatActions(mode);

  if (actions.length === 0) {
    return null;
  }

  const runAction = (action: FormatAction) => {
    const view = getEditorView(editorContainerRef);
    if (view) {
      action.run(view);
    }
  };

  if (compact) {
    const formatting = t('textng.editor.formatting', 'Formatting');

    return (
      <Dropdown
        placement="bottom-start"
        overlay={() => (
          <Menu>
            {actions.map((action) => (
              <Menu.Item key={action.key} icon={action.icon} label={action.tooltip} onClick={() => runAction(action)} />
            ))}
          </Menu>
        )}
      >
        <ToolbarButton
          icon="text-fields"
          tooltip={formatting}
          aria-label={formatting}
          data-testid={FORMAT_TOOLBAR_TEST_ID}
        />
      </Dropdown>
    );
  }

  return (
    <Stack gap={0.5} wrap="wrap" alignItems="center" data-testid={FORMAT_TOOLBAR_TEST_ID}>
      {actions.map((action) => (
        <ToolbarButton key={action.key} icon={action.icon} tooltip={action.tooltip} onClick={() => runAction(action)}>
          {action.label}
        </ToolbarButton>
      ))}
    </Stack>
  );
}
