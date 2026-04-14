import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Button,
  ClipboardButton,
  ColorPickerInput,
  Field,
  Input,
  RadioButtonGroup,
  Tab,
  TabContent,
  TabsBar,
  TextArea,
  useStyles2,
} from '@grafana/ui';

import {
  DEFAULT_DARK_STATE,
  DEFAULT_LIGHT_STATE,
  exportThemeJSON,
  importThemeJSON,
  type ThemeEditorState,
} from './themeEditorState';

interface Props {
  state: ThemeEditorState;
  onChange: (partial: Partial<ThemeEditorState>) => void;
}

const MODE_OPTIONS = [
  { label: 'Dark', value: 'dark' as const },
  { label: 'Light', value: 'light' as const },
];

const TABS = ['Colors', 'Export'] as const;
type TabId = (typeof TABS)[number];

export function ThemeEditorSidebar({ state, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState<TabId>('Colors');

  return (
    <div className={styles.container}>
      <Field label={t('theme-editor.sidebar.theme-name', 'Theme name')} noMargin>
        <Input value={state.name} onChange={(e) => onChange({ name: e.currentTarget.value })} />
      </Field>

      <Field label={t('theme-editor.sidebar.base-mode', 'Base mode')} noMargin>
        <RadioButtonGroup
          value={state.mode}
          options={MODE_OPTIONS}
          onChange={(mode) => {
            const defaults = mode === 'dark' ? DEFAULT_DARK_STATE : DEFAULT_LIGHT_STATE;
            onChange({ ...defaults, name: state.name, id: state.id, mode });
          }}
        />
      </Field>

      <TabsBar>
        {TABS.map((tab) => (
          <Tab key={tab} label={tab} active={activeTab === tab} onChangeTab={() => setActiveTab(tab)} />
        ))}
      </TabsBar>

      <TabContent className={styles.tabContent}>
        {activeTab === 'Colors' && <ColorsTab state={state} onChange={onChange} />}
        {activeTab === 'Export' && <ExportTab state={state} onChange={onChange} />}
      </TabContent>
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
}

function ColorField({ label, color, onChange }: ColorFieldProps) {
  return (
    <Field label={label} noMargin>
      <ColorPickerInput value={color} onChange={onChange} />
    </Field>
  );
}

function ColorsTab({ state, onChange }: Props) {
  const styles = useStyles2(getStyles);

  const handleColorChange = useCallback(
    (key: keyof ThemeEditorState['colors']) => (color: string) => {
      onChange({ colors: { ...state.colors, [key]: color } });
    },
    [onChange, state.colors]
  );

  return (
    <div className={styles.section}>
      <ColorField
        label={t('theme-editor.colors.primary', 'Primary')}
        color={state.colors.primary}
        onChange={handleColorChange('primary')}
      />
      <ColorField
        label={t('theme-editor.colors.background', 'Background (canvas)')}
        color={state.colors.background}
        onChange={handleColorChange('background')}
      />
      <ColorField
        label={t('theme-editor.colors.surface', 'Surface (panels)')}
        color={state.colors.surface}
        onChange={handleColorChange('surface')}
      />
      <ColorField
        label={t('theme-editor.colors.text', 'Text')}
        color={state.colors.textPrimary}
        onChange={handleColorChange('textPrimary')}
      />

      <h6 className={styles.sectionHeader}>{t('theme-editor.colors.status-heading', 'Status colors')}</h6>
      <ColorField
        label={t('theme-editor.colors.success', 'Success')}
        color={state.colors.success}
        onChange={handleColorChange('success')}
      />
      <ColorField
        label={t('theme-editor.colors.warning', 'Warning')}
        color={state.colors.warning}
        onChange={handleColorChange('warning')}
      />
      <ColorField
        label={t('theme-editor.colors.error', 'Error')}
        color={state.colors.error}
        onChange={handleColorChange('error')}
      />
      <ColorField
        label={t('theme-editor.colors.info', 'Info')}
        color={state.colors.info}
        onChange={handleColorChange('info')}
      />
    </div>
  );
}

function ExportTab({ state, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const [importValue, setImportValue] = useState('');
  const [importError, setImportError] = useState('');

  const themeJSON = exportThemeJSON(state);

  const handleImport = () => {
    const imported = importThemeJSON(importValue);
    if (imported) {
      onChange(imported);
      setImportValue('');
      setImportError('');
    } else {
      setImportError(t('theme-editor.export.import-error', 'Invalid theme JSON. Must include name and colors.mode.'));
    }
  };

  return (
    <div className={styles.section}>
      <Field label={t('theme-editor.export.theme-json', 'Theme JSON')} noMargin>
        <TextArea value={themeJSON} rows={12} readOnly />
      </Field>
      <ClipboardButton getText={() => themeJSON} variant="secondary" size="sm">
        {t('theme-editor.export.copy', 'Copy to clipboard')}
      </ClipboardButton>

      <h6 className={styles.sectionHeader}>{t('theme-editor.export.import-heading', 'Import theme')}</h6>
      <Field
        label={t('theme-editor.export.paste-json', 'Paste theme JSON')}
        invalid={!!importError}
        error={importError}
        noMargin
      >
        <TextArea
          value={importValue}
          rows={6}
          placeholder={t(
            'theme-editor.export.paste-placeholder',
            '{"name": "My theme", "colors": {"mode": "dark", ...}}'
          )}
          onChange={(e) => {
            setImportValue(e.currentTarget.value);
            setImportError('');
          }}
        />
      </Field>
      <Button variant="secondary" size="sm" onClick={handleImport} disabled={!importValue.trim()}>
        {t('theme-editor.export.import-button', 'Import')}
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  tabContent: css({
    paddingTop: theme.spacing(2),
  }),
  section: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  sectionHeader: css({
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }),
});
