import { type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';

import { getFieldValue, type ThemeFieldDef } from '../../state/themeStudioModel';

import { ThemeStudioField } from './ThemeStudioField';

interface ComponentsTabProps {
  options: NewThemeOptions;
  derived: GrafanaTheme2;
  onChange: (path: string, value: string | number | undefined) => void;
}

export const ComponentsTab = ({ options, derived, onChange }: ComponentsTabProps) => {
  const fields: ThemeFieldDef[] = [
    {
      path: 'components.input.background',
      label: t('theme-studio.components.input-background', 'Input background'),
      kind: 'color',
    },
  ];

  return (
    <Stack direction="column" gap={1}>
      {fields.map((field) => (
        <ThemeStudioField
          key={field.path}
          field={field}
          value={getFieldValue(options, derived, field)}
          onChange={onChange}
        />
      ))}
    </Stack>
  );
};
