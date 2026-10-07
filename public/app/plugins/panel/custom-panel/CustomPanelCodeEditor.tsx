import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2, type StandardEditorProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { CodeEditor, Combobox, type ComboboxOption, ConfirmModal, Stack, useStyles2 } from '@grafana/ui';

import { getStarterTemplates, type StarterTemplate, type StarterTemplateId } from './templates';
import { type Options } from './types';

export const CustomPanelCodeEditor = ({ value, onChange }: StandardEditorProps<string, {}, Options>) => {
  const styles = useStyles2(getStyles);
  const templates = useMemo(() => getStarterTemplates(), []);
  const [pendingTemplate, setPendingTemplate] = useState<StarterTemplate | null>(null);

  const templateOptions = useMemo<Array<ComboboxOption<StarterTemplateId>>>(
    () =>
      templates.map((template) => ({ value: template.id, label: template.label, description: template.description })),
    [templates]
  );

  const onTemplateChange = (option: ComboboxOption<StarterTemplateId>) => {
    const template = templates.find((candidate) => candidate.id === option.value);
    if (!template) {
      return;
    }
    const current = value ?? '';
    if (current.trim() !== '' && current !== template.code) {
      setPendingTemplate(template);
      return;
    }
    onChange(template.code);
  };

  return (
    <div className={styles.editorBox}>
      <Stack direction="column" gap={1}>
        <p className={styles.help}>
          <Trans i18nKey="custom-panel.editor.help">
            Call panel.onRender(draw). The code runs in a sandbox with no network access.
          </Trans>
        </p>
        <Combobox
          options={templateOptions}
          value={null}
          onChange={onTemplateChange}
          placeholder={t('custom-panel.editor.insert-template', 'Insert template')}
          aria-label={t('custom-panel.editor.insert-template', 'Insert template')}
        />
        <CodeEditor
          value={value ?? ''}
          onBlur={onChange}
          onSave={onChange}
          language="javascript"
          width="100%"
          height="400px"
          showMiniMap={false}
          showLineNumbers={true}
        />
      </Stack>
      <ConfirmModal
        isOpen={pendingTemplate !== null}
        title={t('custom-panel.editor.replace-title', 'Replace drawing code?')}
        body={t(
          'custom-panel.editor.replace-body',
          'The "{{template}}" template replaces the current drawing code. Your changes are lost.',
          { template: pendingTemplate?.label ?? '' }
        )}
        confirmText={t('custom-panel.editor.replace-confirm', 'Replace')}
        onConfirm={() => {
          if (pendingTemplate) {
            onChange(pendingTemplate.code);
          }
          setPendingTemplate(null);
        }}
        onDismiss={() => setPendingTemplate(null)}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorBox: css({
    label: 'editorBox',
    margin: theme.spacing(0.5, 0),
    width: '100%',
  }),
  help: css({
    margin: 0,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
