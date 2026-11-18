import { insertNewlineContinueMarkup, insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { Prec, type Extension } from '@codemirror/state';
import { keymap, placeholder as placeholderExtension, type KeyBinding, type EditorView } from '@codemirror/view';
import { useMemo, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type CellContentKind } from 'app/features/notebook/types';

import { MarkdownFormatToolbar } from './MarkdownFormatToolbar';
import { navigationKeymap, scrollMarginExtension } from './focusExtension';
import {
  enclosingListKind,
  markdownLivePreview,
  newlineInsertionPoint,
  nextListContinuation,
} from './markdownLivePreview';

const continueChecklistMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

function continueChecklist(view: EditorView) {
  const { state } = view;
  if (state.selection.main.empty) {
    const pos = state.selection.main.head;
    const insertAt = newlineInsertionPoint(syntaxTree(state), pos);
    if (insertAt !== pos) {
      view.dispatch({ selection: { anchor: insertAt } });
    }
  }
  return continueChecklistMarkup(view);
}

const EDIT_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  history: false,
  syntaxHighlighting: false,
};

export interface MarkdownCellEditorProps {
  content: CellContentKind;
  onChange: (content: CellContentKind) => void;
  placeholder?: string;
  onSubmit?: (remainder: string, marker?: string) => void;
  /** ArrowUp/ArrowDown once the caret has nowhere further to go inside this cell. See navigationKeymap. */
  onNavigate?: (direction: 'up' | 'down') => void;
  focusExtension?: Extension[];
}

export function MarkdownCellEditor({
  content,
  onChange,
  placeholder,
  onSubmit,
  onNavigate,
  focusExtension,
}: MarkdownCellEditorProps) {
  const theme = useTheme2();
  const livePreview = useMemo(() => markdownLivePreview(theme), [theme]);
  const scrollMargin = useMemo(() => scrollMarginExtension(theme), [theme]);

  const editorContainerRef = useRef<HTMLDivElement>(null);

  const contentText = content.kind === 'Markdown' ? content.spec.text : '';
  const [text, setText] = useState(contentText);
  const lastEmittedText = useRef(contentText);
  if (contentText !== lastEmittedText.current) {
    setText(contentText);
    lastEmittedText.current = contentText;
  }

  const placeholderExt = useMemo(() => (placeholder ? [placeholderExtension(placeholder)] : []), [placeholder]);

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const hasOnSubmit = Boolean(onSubmit);
  const enterExt = useMemo(() => {
    const bindings: KeyBinding[] = [
      {
        key: 'Shift-Enter',
        run: (view) => {
          const pos = view.state.selection.main.head;
          const tree = syntaxTree(view.state);
          const insertAt = newlineInsertionPoint(tree, pos);

          if (enclosingListKind(tree, pos) === 'checklist') {
            return continueChecklist(view);
          }

          if (enclosingListKind(tree, pos)) {
            const marker = nextListContinuation(view.state, pos);
            if (marker === undefined) {
              return insertNewlineContinueMarkup(view);
            }
            view.dispatch({
              changes: { from: insertAt, insert: '\n' + marker },
              selection: { anchor: insertAt + 1 + marker.length },
              scrollIntoView: true,
            });
            return true;
          }

          if (insertAt === pos) {
            return false;
          }
          view.dispatch({
            changes: { from: insertAt, insert: '\n' },
            selection: { anchor: insertAt + 1 },
            scrollIntoView: true,
          });
          return true;
        },
      },
    ];

    if (hasOnSubmit) {
      bindings.push({
        key: 'Enter',
        run: (view) => {
          const { state } = view;
          const pos = state.selection.main.head;
          const tree = syntaxTree(state);

          if (enclosingListKind(tree, pos) === 'checklist') {
            return continueChecklist(view);
          }

          let marker: string | undefined;
          if (enclosingListKind(tree, pos)) {
            marker = nextListContinuation(state, pos);
            if (marker === undefined) {
              return false;
            }
          }

          const splitAt = newlineInsertionPoint(tree, pos);

          const remainder = state.sliceDoc(splitAt, state.doc.length);
          if (remainder) {
            view.dispatch({ changes: { from: splitAt, to: state.doc.length } });
          }

          onSubmitRef.current?.(remainder, marker);
          return true;
        },
      });
    }

    return [Prec.highest(keymap.of(bindings))];
  }, [hasOnSubmit]);

  // Same ref-backed pattern as onSubmitRef above: onNavigate's identity changes every render, but
  // whether this cell has the behavior at all doesn't.
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const hasOnNavigate = Boolean(onNavigate);
  const navigateExt = useMemo(() => {
    if (!hasOnNavigate) {
      return [];
    }
    return navigationKeymap((direction) => onNavigateRef.current?.(direction));
  }, [hasOnNavigate]);

  if (content.kind !== 'Markdown') {
    return null;
  }

  return (
    <div ref={editorContainerRef}>
      <CodeMirrorEditor
        value={text}
        height="auto"
        lineWrapping
        basicSetup={EDIT_SETUP}
        // Tab leaves the cell instead of indenting. CodeMirror binds Tab to indent by default,
        // which holds the keyboard inside the editor with no way out.
        indentWithTab={false}
        theme={livePreview.theme}
        extensions={[
          livePreview.extensions,
          scrollMargin,
          ...placeholderExt,
          ...enterExt,
          ...navigateExt,
          ...(focusExtension ?? []),
        ]}
        aria-label={t('notebook.cell.markdown.aria-label-editor', 'Markdown')}
        onChange={(value) => {
          setText(value);
          lastEmittedText.current = value;
          onChange({ kind: 'Markdown', spec: { ...content.spec, text: value } });
        }}
      />
      <MarkdownFormatToolbar editorContainerRef={editorContainerRef} />
    </div>
  );
}
