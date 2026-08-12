import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Combobox, type ComboboxOption, Stack, Text, useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type CellContentKind } from 'app/features/notebook/types';

import { codeLanguageLabel, getCodeLanguageOptions, PLAIN_TEXT_LANGUAGE, toCodeMirrorLanguage } from './codeLanguages';

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
};

interface Props {
  content: CellContentKind;
  isEditing: boolean;
  onChange: (content: CellContentKind) => void;
}

export function CodeCell({ content, isEditing, onChange }: Props) {
  const styles = useStyles2(getStyles);

  if (content.kind !== 'Code') {
    return null;
  }

  const { code, language } = content.spec;

  // Spread the existing spec rather than rebuilding it: `highlight` and `annotation` are optional
  // schema fields nothing reads yet, and rebuilding would drop them on the first keystroke.
  const changeSpec = (changes: Partial<typeof content.spec>) =>
    onChange({ kind: 'Code', spec: { ...content.spec, ...changes } });

  return (
    <Box borderStyle="solid" borderColor="weak" borderRadius="default" padding={1}>
      <Stack direction="column" gap={0.5}>
        <Stack justifyContent="flex-end" alignItems="center">
          {isEditing ? (
            <Combobox
              options={getCodeLanguageOptions(language)}
              value={language}
              width="auto"
              minWidth={12}
              aria-label={t('notebooks.cell.code.aria-label-language', 'Code language')}
              onChange={(option: ComboboxOption<string>) => changeSpec({ language: option.value })}
            />
          ) : (
            <Text variant="bodySmall" color="secondary">
              {language === PLAIN_TEXT_LANGUAGE ? t('notebooks.cell.code.label', 'code') : codeLanguageLabel(language)}
            </Text>
          )}
        </Stack>

        <CodeMirrorEditor
          value={code}
          language={toCodeMirrorLanguage(language)}
          // Grows with its content: a notebook is a document, so a cell that scrolls internally
          // inside a page that already scrolls is worse than a tall cell.
          height="auto"
          readOnly={!isEditing}
          lineWrapping
          basicSetup={isEditing ? EDIT_SETUP : VIEW_SETUP}
          aria-label={t('notebooks.cell.code.aria-label-editor', 'Code')}
          // The editor is a lazily loaded chunk; without this the cell is a blank gap mid-document
          // until it arrives.
          loadingFallback={<pre className={styles.loadingFallback}>{code}</pre>}
          onChange={(value) => changeSpec({ code: value })}
        />
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
});
