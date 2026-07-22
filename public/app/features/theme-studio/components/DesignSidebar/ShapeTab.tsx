import { type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';
import { t } from '@grafana/i18n';

import { type ThemeFieldDef } from '../../state/themeStudioModel';

import { ThemeFieldList } from './ThemeFieldList';

interface ShapeTabProps {
  options: NewThemeOptions;
  derived: GrafanaTheme2;
  onChange: (path: string, value: string | number | undefined) => void;
}

export const ShapeTab = ({ options, derived, onChange }: ShapeTabProps) => {
  const fields: ThemeFieldDef[] = [
    {
      path: 'shape.borderRadiusSm',
      derivedPath: 'shape.radius.sm',
      label: t('theme-studio.shape.border-radius-sm', 'Border radius (small)'),
      kind: 'number',
    },
    {
      path: 'shape.borderRadius',
      derivedPath: 'shape.radius.default',
      label: t('theme-studio.shape.border-radius', 'Border radius'),
      kind: 'number',
    },
    {
      path: 'shape.borderRadiusLg',
      derivedPath: 'shape.radius.lg',
      label: t('theme-studio.shape.border-radius-lg', 'Border radius (large)'),
      kind: 'number',
    },
  ];

  return <ThemeFieldList fields={fields} options={options} derived={derived} onChange={onChange} />;
};
