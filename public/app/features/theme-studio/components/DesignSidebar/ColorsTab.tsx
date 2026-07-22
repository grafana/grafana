import { type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Field, FieldSet, Stack, Text } from '@grafana/ui';

import { getFieldValue, type ThemeFieldDef } from '../../state/themeStudioModel';

import { ThemeStudioField } from './ThemeStudioField';

interface ColorsTabProps {
  options: NewThemeOptions;
  derived: GrafanaTheme2;
  onChange: (path: string, value: string | number | undefined) => void;
}

interface FieldGroup {
  label: string;
  fields: ThemeFieldDef[];
}

const modeOptions: Array<ComboboxOption<string>> = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export const ColorsTab = ({ options, derived, onChange }: ColorsTabProps) => {
  const groups: FieldGroup[] = [
    {
      label: t('theme-studio.colors.group-background', 'Background'),
      fields: [
        { path: 'colors.background.canvas', label: t('theme-studio.colors.bg-canvas', 'Canvas'), kind: 'color' },
        { path: 'colors.background.page', label: t('theme-studio.colors.bg-page', 'Page'), kind: 'color' },
        { path: 'colors.background.primary', label: t('theme-studio.colors.bg-primary', 'Primary'), kind: 'color' },
        {
          path: 'colors.background.secondary',
          label: t('theme-studio.colors.bg-secondary', 'Secondary'),
          kind: 'color',
        },
        { path: 'colors.background.elevated', label: t('theme-studio.colors.bg-elevated', 'Elevated'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-primary', 'Primary'),
      fields: [{ path: 'colors.primary.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' }],
    },
    {
      label: t('theme-studio.colors.group-secondary', 'Secondary'),
      fields: [
        { path: 'colors.secondary.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' },
        { path: 'colors.secondary.border', label: t('theme-studio.colors.border', 'Border'), kind: 'color' },
        { path: 'colors.secondary.text', label: t('theme-studio.colors.text', 'Text'), kind: 'color' },
        {
          path: 'colors.secondary.contrastText',
          label: t('theme-studio.colors.contrast-text', 'Contrast text'),
          kind: 'color',
        },
      ],
    },
    {
      label: t('theme-studio.colors.group-tertiary', 'Tertiary'),
      fields: [{ path: 'colors.tertiary.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' }],
    },
    {
      label: t('theme-studio.colors.group-accent', 'Accent'),
      fields: [
        { path: 'colors.accent.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' },
        { path: 'colors.accent.text', label: t('theme-studio.colors.text', 'Text'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-error', 'Error'),
      fields: [
        { path: 'colors.error.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' },
        { path: 'colors.error.border', label: t('theme-studio.colors.border', 'Border'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-warning', 'Warning'),
      fields: [
        { path: 'colors.warning.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' },
        { path: 'colors.warning.border', label: t('theme-studio.colors.border', 'Border'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-success', 'Success'),
      fields: [
        { path: 'colors.success.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' },
        { path: 'colors.success.border', label: t('theme-studio.colors.border', 'Border'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-info', 'Info'),
      fields: [
        { path: 'colors.info.main', label: t('theme-studio.colors.main', 'Main'), kind: 'color' },
        { path: 'colors.info.border', label: t('theme-studio.colors.border', 'Border'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-text', 'Text'),
      fields: [
        { path: 'colors.text.primary', label: t('theme-studio.colors.text-primary', 'Primary'), kind: 'color' },
        { path: 'colors.text.secondary', label: t('theme-studio.colors.text-secondary', 'Secondary'), kind: 'color' },
        { path: 'colors.text.disabled', label: t('theme-studio.colors.text-disabled', 'Disabled'), kind: 'color' },
        { path: 'colors.text.link', label: t('theme-studio.colors.text-link', 'Link'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-border', 'Border'),
      fields: [
        { path: 'colors.border.weak', label: t('theme-studio.colors.border-weak', 'Weak'), kind: 'color' },
        { path: 'colors.border.medium', label: t('theme-studio.colors.border-medium', 'Medium'), kind: 'color' },
        { path: 'colors.border.strong', label: t('theme-studio.colors.border-strong', 'Strong'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-gradients', 'Gradients'),
      fields: [
        {
          path: 'colors.gradients.brandHorizontal',
          label: t('theme-studio.colors.gradient-horizontal', 'Brand horizontal'),
          kind: 'text',
        },
        {
          path: 'colors.gradients.brandVertical',
          label: t('theme-studio.colors.gradient-vertical', 'Brand vertical'),
          kind: 'text',
        },
      ],
    },
    {
      label: t('theme-studio.colors.group-action', 'Action'),
      fields: [
        { path: 'colors.action.selected', label: t('theme-studio.colors.action-selected', 'Selected'), kind: 'color' },
        { path: 'colors.action.hover', label: t('theme-studio.colors.action-hover', 'Hover'), kind: 'color' },
        { path: 'colors.action.focus', label: t('theme-studio.colors.action-focus', 'Focus'), kind: 'color' },
      ],
    },
    {
      label: t('theme-studio.colors.group-misc', 'Miscellaneous'),
      fields: [
        {
          path: 'colors.contrastThreshold',
          label: t('theme-studio.colors.contrast-threshold', 'Contrast threshold'),
          kind: 'number',
        },
      ],
    },
  ];

  const mode = options.colors?.mode ?? derived.colors.mode;

  return (
    <Stack direction="column" gap={2}>
      <Field noMargin label={t('theme-studio.colors.mode', 'Mode')}>
        <Combobox options={modeOptions} value={mode} onChange={(option) => onChange('colors.mode', option.value)} />
      </Field>

      {groups.map((group) => (
        <FieldSet key={group.label} label={group.label}>
          <Stack direction="column" gap={1}>
            {group.fields.map((field) => (
              <ThemeStudioField
                key={field.path}
                field={field}
                value={getFieldValue(options, derived, field)}
                onChange={onChange}
              />
            ))}
          </Stack>
        </FieldSet>
      ))}

      <Text variant="bodySmall" color="secondary">
        {t(
          'theme-studio.colors.hint',
          'Only fields you change are written to the exported JSON, matching the built-in theme definitions.'
        )}
      </Text>
    </Stack>
  );
};
