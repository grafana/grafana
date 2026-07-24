import { type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';
import { t } from '@grafana/i18n';

import { type ThemeFieldDef } from '../../state/themeStudioModel';

import { ThemeFieldList } from './ThemeFieldList';

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

  return <ThemeFieldList fields={fields} options={options} derived={derived} onChange={onChange} />;
};
