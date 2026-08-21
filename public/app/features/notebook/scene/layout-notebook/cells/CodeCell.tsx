import { ViewPlugin } from '@codemirror/view';
import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Combobox, type ComboboxOption, Stack, Text, useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type CellContentKind } from 'app/features/notebook/types';

import {
  canonicalLanguage,
  codeLanguageLabel,
  getCodeLanguageOptions,
  normalizeLanguage,
  toCodeMirrorLanguage,
} from './codeLanguages';

// Reading a notebook should look like reading a document, so everything that makes CodeMirror feel
// like an IDE is off. The gutter goes in both modes: the design has no line numbers.
const VIEW_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
  closeBrackets: false,
  autocompletion: false,
  highlightSelectionMatches: false,
  history: false,
  indentOnInput: false,
  allowMultipleSelections: false,
  rectangularSelection: false,
  crosshairCursor: false,
  dropCursor: false,
};

const EDIT_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  history: false,
};

/**
 * An extension that puts the caret in the editor.
 *
 * CodeMirrorEditor exposes no ref, no autoFocus and no onCreateEditor, so a view plugin is the only
 * hook into an editor that arrives with a lazily loaded chunk — it runs whenever CodeMirror builds
 * the view, however many frames later that is.
 *
 * The focus is deferred a frame for two reasons, both races it would otherwise lose: a plugin is
 * constructed before the view's DOM is appended to its parent, and focusing a detached node does
 * nothing; and the controls that ask for this — the add-block menu, the language picker — hand focus
 * back to themselves as they close, which floating-ui does in a microtask.
 *
 * A fresh plugin per request, because CodeMirror rebuilds its plugins exactly when the extensions
 * array stops being shallow-equal. That makes a new one the way to ask for the caret again.
 */
function buildFocusExtension() {
  return [
    ViewPlugin.define((view) => {
      requestAnimationFrame(() => view.focus());
      return {};
    }),
  ];
}

interface Props {
  content: CellContentKind;
  isEditing: boolean;
  /** Set on a cell the reader just inserted, so they can type into it without clicking it first. */
  autoFocus?: boolean;
  onChange: (content: CellContentKind) => void;
}

export function CodeCell({ content, isEditing, autoFocus, onChange }: Props) {
  const styles = useStyles2(getStyles);

  // Counts requests for the caret rather than holding a boolean, so a second request after the reader
  // has clicked away is still a change. Zero means nobody has asked, which is the usual case — and the
  // mode is read once, at mount, rather than tracked: a read-only editor must not pull focus, but
  // making that a live condition would re-fire every request each time the reader re-enters edit mode.
  const [focusRequests, setFocusRequests] = useState(autoFocus && isEditing ? 1 : 0);
  const requestFocus = useCallback(() => setFocusRequests((count) => count + 1), []);

  const focusExtension = useMemo(() => (focusRequests > 0 ? buildFocusExtension() : undefined), [focusRequests]);

  if (content.kind !== 'Code') {
    return null;
  }

  const { code, language } = content.spec;

  // Spread the existing spec rather than rebuilding it: `highlight` and `annotation` are optional
  // schema fields nothing reads yet, and rebuilding would drop them on the first keystroke.
  const changeSpec = (changes: Partial<typeof content.spec>) =>
    onChange({ kind: 'Code', spec: { ...content.spec, ...changes } });

  return (
    // The language sits above the frame rather than inside it: in the box it stole a full row of
    // height from every cell, which reads as padding around short snippets.
    <Stack direction="column" gap={0.5}>
      <Stack justifyContent="flex-end" alignItems="center">
        {isEditing ? (
          <Combobox
            options={getCodeLanguageOptions(language)}
            // Canonical, so the control matches an option even when the cell was authored elsewhere
            // as `yml` or `YAML`. getCodeLanguageOptions canonicalises the same way.
            value={canonicalLanguage(language)}
            width="auto"
            minWidth={12}
            aria-label={t('notebook.cell.code.aria-label-language', 'Code language')}
            // The eight highlighted languages plus promql and logql are not the whole world, and the
            // picker is the only way to set a language — so anything else can be typed in.
            createCustomValue
            customValueDescription={t('notebook.cell.code.custom-language', 'Use this language name')}
            onChange={(option: ComboboxOption<string>) => {
              // Normalised on the way in, so a typed `PromQL` is stored the same as the offered
              // `promql` and will match if highlighting for it lands later.
              changeSpec({ language: normalizeLanguage(option.value) });
              // The picker is part of the cell, not a stop on the way out of it: choosing a language is
              // something you do in order to write code, so the caret goes back where it was typing.
              requestFocus();
            }}
          />
        ) : (
          <Text variant="bodySmall" color="secondary">
            {codeLanguageLabel(language)}
          </Text>
        )}
      </Stack>

      <Box borderStyle="solid" borderColor="weak" borderRadius="default" padding={1}>
        <CodeMirrorEditor
          value={code}
          language={toCodeMirrorLanguage(language)}
          // Grows with its content: a notebook is a document, so a cell that scrolls internally
          // inside a page that already scrolls is worse than a tall cell.
          height="auto"
          readOnly={!isEditing}
          lineWrapping
          basicSetup={isEditing ? EDIT_SETUP : VIEW_SETUP}
          extensions={focusExtension}
          aria-label={t('notebook.cell.code.aria-label-editor', 'Code')}
          // The editor is a lazily loaded chunk; without this the cell is a blank gap mid-document
          // until it arrives.
          loadingFallback={<pre className={styles.loadingFallback}>{code}</pre>}
          onChange={(value) => changeSpec({ code: value })}
        />
      </Box>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Mirrors the CodeMirror theme so the swap from fallback to editor doesn't shift the layout.
  loadingFallback: css({
    margin: 0,
    padding: '4px 2px 4px 6px',
    overflow: 'auto',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.code.fontSize,
    lineHeight: theme.typography.code.lineHeight,
    color: theme.components.input.text,
    backgroundColor: theme.components.input.background,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});
