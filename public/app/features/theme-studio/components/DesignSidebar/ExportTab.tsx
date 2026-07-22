import { useMemo, useState } from 'react';

import { type NewThemeOptions } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, FieldSet, TextArea } from '@grafana/ui';

interface ExportTabProps {
  options: NewThemeOptions;
}

export const ExportTab = ({ options }: ExportTabProps) => {
  const json = useMemo(() => JSON.stringify(options, null, 2), [options]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn('Unable to copy theme JSON', error);
    }
  };

  return (
    <FieldSet label={t('theme-studio.export-tab.title', 'Export')}>
      <Field noMargin label={t('theme-studio.export-tab.json-label', 'Theme JSON')}>
        <TextArea value={json} rows={16} readOnly />
      </Field>
      <Button variant="secondary" icon="copy" onClick={handleCopy}>
        {copied
          ? t('theme-studio.export-tab.copied', 'Copied!')
          : t('theme-studio.export-tab.copy', 'Copy JSON to clipboard')}
      </Button>
    </FieldSet>
  );
};
