import { css } from '@emotion/css';
import { useCallback, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Combobox, type ComboboxOption, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type CellContentKind } from 'app/features/notebook/types';

import {
  canonicalLanguage,
  codeLanguageLabel,
  getCodeLanguageOptions,
  normalizeLanguage,
  toCodeMirrorLanguage,
} from './codeLanguages';
import { navigationKeymap, scrollMarginExtension, useFocusExtension } from './focusExtension';

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

interface Props {
  content: CellContentKind;
  isEditing: boolean;
  /** Set on a cell the reader just inserted, so they can type into it without clicking it first. */
  autoFocus?: boolean;
  /**
   * A nonce for an external focus grant — e.g. arrow-key navigation from a sibling cell (see
   * NotebookLayoutManagerRenderer's own `focusRequest` state). Merged below into the same local nonce
   * the language picker already uses, so useFocusExtension only ever watches one at a time
   */
  focusRequestId?: number;
  /** Where the caret should land on that grant. */
  caretOffset?: number;
  /** Which edge of the cell to reveal on that same grant. */
  scrollAlign?: ScrollLogicalPosition;
  onChange: (content: CellContentKind) => void;
  /** ArrowUp/ArrowDown once the caret has nowhere further to go inside this cell. See navigationKeymap. */
  onNavigate?: (direction: 'up' | 'down') => void;
}

export function CodeCell({
  content,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  scrollAlign,
  onChange,
  onNavigate,
}: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const scrollMargin = useMemo(() => scrollMarginExtension(theme), [theme]);

  const [localRequest, setLocalRequest] = useState<{
    id: number;
    caret?: number | 'preserve';
    scrollAlign?: ScrollLogicalPosition;
  }>();
  const requestFocus = useCallback(
    () => setLocalRequest((prev) => ({ id: (prev?.id ?? 0) + 1, caret: 'preserve' })),
    []
  );

  // Bridges a fresh external `focusRequestId` into that same local nonce — the same "compare against
  // what was last seen" pattern MarkdownCell's own `lastEmittedText` uses during render, rather than
  // an effect (and the extra render an effect would cost).
  const pendingExternalRequest = useRef(focusRequestId !== undefined);
  const previousExternalId = useRef(focusRequestId);
  if (
    pendingExternalRequest.current ||
    (focusRequestId !== undefined && focusRequestId !== previousExternalId.current)
  ) {
    pendingExternalRequest.current = false;
    previousExternalId.current = focusRequestId;
    setLocalRequest((prev) => ({ id: (prev?.id ?? 0) + 1, caret: caretOffset, scrollAlign }));
  }

  const focusExtension = useFocusExtension({
    autoFocus,
    isEditing,
    focusRequestId: localRequest?.id,
    caretOnFocus: localRequest?.caret,
    scrollAlign: localRequest?.scrollAlign,
  });

  // Same ref-backed pattern MarkdownCell's own onSubmitRef uses: onNavigate's identity changes every
  // render, but whether this cell has the behavior at all doesn't.
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const navigateExt = useMemo(() => {
    if (!onNavigate) {
      return [];
    }
    return navigationKeymap((direction) => onNavigateRef.current?.(direction));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ref is always current; only whether onNavigate exists at all should rebuild this
  }, [Boolean(onNavigate)]);

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
          extensions={[scrollMargin, ...navigateExt, ...(focusExtension ?? [])]}
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
