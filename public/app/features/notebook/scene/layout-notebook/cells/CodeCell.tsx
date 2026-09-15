import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, Button, Combobox, type ComboboxOption, Icon, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type CellContentKind } from 'app/features/notebook/types';

import {
  canonicalLanguage,
  codeLanguageLabel,
  getCodeLanguageOptions,
  isExecutableLanguage,
  normalizeLanguage,
  toCodeMirrorLanguage,
} from './codeLanguages';
import { executeCode, type CodeExecutionResult } from './executeCode';
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

  // Ephemeral by design: a run's output lives in component state, not in the notebook spec, so it is
  // never saved or exported — reopening a notebook shows the code, and the reader runs it themselves.
  const [output, setOutput] = useState<CodeExecutionResult>();
  const [running, setRunning] = useState(false);

  if (content.kind !== 'Code') {
    return null;
  }

  const { code, language } = content.spec;

  const executable = isExecutableLanguage(language);
  const hasCode = code.trim().length > 0;

  const runCode = async () => {
    setRunning(true);
    setOutput(undefined);
    const result = await executeCode(code);
    setOutput(result);
    setRunning(false);
  };

  // Spread the existing spec rather than rebuilding it: `highlight` and `annotation` are optional
  // schema fields nothing reads yet, and rebuilding would drop them on the first keystroke.
  const changeSpec = (changes: Partial<typeof content.spec>) =>
    onChange({ kind: 'Code', spec: { ...content.spec, ...changes } });

  return (
    // The language sits above the frame rather than inside it: in the box it stole a full row of
    // height from every cell, which reads as padding around short snippets.
    <Stack direction="column" gap={0.5}>
      <Stack justifyContent="space-between" alignItems="center">
        {/* Left of the frame: the Run affordance, shown for a language the browser can execute. A
            reader can run a cell without entering edit mode, the same as reading and running a
            notebook anywhere else. */}
        {executable ? (
          <Button
            size="sm"
            variant="secondary"
            icon={running ? 'spinner' : 'play'}
            disabled={running || !hasCode}
            onClick={runCode}
            aria-label={t('notebook.cell.code.aria-label-run', 'Run code')}
          >
            {running ? t('notebook.cell.code.running', 'Running') : t('notebook.cell.code.run', 'Run')}
          </Button>
        ) : (
          <span />
        )}
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

      {output && <CodeOutput output={output} />}
    </Stack>
  );
}

// The result of the most recent run: any console output, then the cell's value or the error it threw.
// Everything is rendered as plain text through React's own escaping — never as HTML — so a cell that
// logs or returns a string of markup shows that markup verbatim rather than injecting it.
function CodeOutput({ output }: { output: CodeExecutionResult }) {
  const styles = useStyles2(getStyles);
  const { logs, value, error, durationMs } = output;
  const isEmpty = logs.length === 0 && value === undefined && error === undefined;

  return (
    <Box borderStyle="solid" borderColor="weak" borderRadius="default" padding={1} backgroundColor="secondary">
      <Stack direction="column" gap={0.5}>
        <Stack justifyContent="space-between" alignItems="center">
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="notebook.cell.code.output-label">Output</Trans>
          </Text>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="notebook.cell.code.ran-in" values={{ duration: Math.round(durationMs) }}>
              {'{{duration}} ms'}
            </Trans>
          </Text>
        </Stack>

        {logs.map((log, index) => (
          <pre key={index} className={cx(styles.output, styles.logLevel[log.level])}>
            {log.text}
          </pre>
        ))}

        {error !== undefined && (
          <pre className={cx(styles.output, styles.logLevel.error)}>
            <Icon name="exclamation-triangle" /> {error}
          </pre>
        )}

        {value !== undefined && (
          <pre className={cx(styles.output, styles.resultValue)}>
            <span className={styles.resultArrow} aria-hidden>
              {'\u2192 '}
            </span>
            <span>{value}</span>
          </pre>
        )}

        {isEmpty && (
          <Text variant="bodySmall" color="secondary" italic>
            <Trans i18nKey="notebook.cell.code.no-output">Ran with no output</Trans>
          </Text>
        )}
      </Stack>
    </Box>
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
  // A single console line or the result value: monospaced to match the editor, wrapping so a long
  // object never forces the document sideways.
  output: css({
    margin: 0,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.code.fontSize,
    lineHeight: theme.typography.code.lineHeight,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: theme.colors.text.primary,
  }),
  // Console levels borrow the same semantic colors the rest of Grafana uses for warnings and errors,
  // so a `console.warn` reads as a warning without a legend.
  logLevel: {
    log: css({}),
    info: css({ color: theme.colors.info.text }),
    debug: css({ color: theme.colors.text.secondary }),
    warn: css({ color: theme.colors.warning.text }),
    error: css({ color: theme.colors.error.text }),
  },
  resultValue: css({
    color: theme.colors.text.primary,
  }),
  // The REPL arrow that marks the value line as the cell's result rather than one more log line.
  resultArrow: css({
    color: theme.colors.text.secondary,
    userSelect: 'none',
  }),
});
