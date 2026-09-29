import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Icon, Menu, Stack, useStyles2 } from '@grafana/ui';

import { CodeLanguage, defaultCodeLanguage, TextMode } from '../../panelcfg.gen';

const getLanguageLabels = (): Record<CodeLanguage, string> => ({
  [CodeLanguage.Go]: 'Go',
  [CodeLanguage.Html]: 'HTML',
  [CodeLanguage.Json]: 'JSON',
  [CodeLanguage.Markdown]: 'Markdown',
  [CodeLanguage.Plaintext]: t('textng.editor.language-plaintext', 'Plain text'),
  [CodeLanguage.Sql]: 'SQL',
  [CodeLanguage.Typescript]: 'TypeScript',
  [CodeLanguage.Xml]: 'XML',
  [CodeLanguage.Yaml]: 'YAML',
});

export interface TextNGModeChange {
  mode: TextMode;
  codeLanguage?: CodeLanguage;
}

interface Props {
  mode: TextMode;
  codeLanguage?: CodeLanguage;
  onChange: (change: TextNGModeChange) => void;
}

/**
 * Picks the panel's text mode. Rendered by the content editor and, since insight mode has no
 * editor of its own, by the insight view too — otherwise switching out of insight is impossible.
 */
export function TextNGModePicker({ mode, codeLanguage, onChange }: Props) {
  const styles = useStyles2(getStyles);

  const modeLabels: Record<TextMode, string> = {
    [TextMode.Markdown]: t('textng.editor.mode-markdown', 'Markdown'),
    [TextMode.HTML]: t('textng.editor.mode-html', 'HTML'),
    [TextMode.Code]: t('textng.editor.mode-code', 'Code'),
    [TextMode.Insight]: t('textng.editor.mode-insight', 'Insight'),
  };
  const languageLabels = getLanguageLabels();
  const languageOptions = Object.values(CodeLanguage).map((value) => ({ value, label: languageLabels[value] }));

  const language = codeLanguage ?? defaultCodeLanguage;
  const modeValue = mode === TextMode.Code ? `${modeLabels[mode]} · ${languageLabels[language]}` : modeLabels[mode];

  const renderModeMenu = () => (
    <Menu>
      {[TextMode.Markdown, TextMode.HTML].map((value) => (
        <Menu.Item
          key={value}
          className={styles.pickerMenuItem}
          label={modeLabels[value]}
          role="menuitemradio"
          ariaChecked={value === mode}
          active={value === mode}
          onClick={() => onChange({ mode: value })}
        />
      ))}
      <Menu.Item
        className={styles.pickerMenuItem}
        label={modeLabels[TextMode.Code]}
        active={mode === TextMode.Code}
        childItems={languageOptions.map((option) => (
          <Menu.Item
            key={option.value}
            className={styles.pickerMenuItem}
            label={option.label}
            role="menuitemradio"
            ariaChecked={mode === TextMode.Code && option.value === language}
            active={mode === TextMode.Code && option.value === language}
            onClick={() => onChange({ mode: TextMode.Code, codeLanguage: option.value })}
          />
        ))}
      />
      <Menu.Divider />
      {/* Switching here swaps the panel for the insight view, whose inputs are in the options pane. */}
      <Menu.Item
        className={styles.pickerMenuItem}
        label={modeLabels[TextMode.Insight]}
        icon="ai-sparkle"
        role="menuitemradio"
        ariaChecked={mode === TextMode.Insight}
        active={mode === TextMode.Insight}
        onClick={() => onChange({ mode: TextMode.Insight })}
      />
    </Menu>
  );

  return (
    <Dropdown placement="bottom-end" overlay={renderModeMenu}>
      <Button
        className={styles.modePicker}
        fill="text"
        size="sm"
        variant="secondary"
        aria-label={t('textng.editor.aria-label-mode', 'Text mode: {{mode}}', { mode: modeValue })}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          <span className={styles.pickerLabel}>{t('textng.editor.mode-picker-label', 'Mode')}</span>
          {modeValue}
          <Icon name="angle-down" />
        </Stack>
      </Button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modePicker: css({
    marginLeft: 'auto',
  }),
  pickerMenuItem: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  pickerLabel: css({
    color: theme.colors.text.secondary,
  }),
});
