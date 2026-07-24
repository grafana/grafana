import { type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';
import { Stack } from '@grafana/ui';

import { getFieldValue, type ThemeFieldDef } from '../../state/themeStudioModel';

import { ThemeStudioField } from './ThemeStudioField';

interface Props {
  fields: ThemeFieldDef[];
  options: NewThemeOptions;
  derived: GrafanaTheme2;
  onChange: (path: string, value: string | number | undefined) => void;
}

export const ThemeFieldList = ({ fields, options, derived, onChange }: Props) => (
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
