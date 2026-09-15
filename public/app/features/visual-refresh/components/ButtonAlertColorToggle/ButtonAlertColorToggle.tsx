import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Field, useTheme2 } from '@grafana/ui';

import { useButtonAlertColorMode, type ButtonAlertColorMode } from '../../../../core/hooks/useButtonAlertColorMode';

/**
 * Design experiment dropdown shown in the theme selector drawer: how solid buttons, outline
 * buttons, and alerts of the same severity relate to each other's color. Only meaningful (and
 * shown) while the visual design refresh is enabled.
 */
export function ButtonAlertColorToggle() {
  const theme = useTheme2();
  const [mode, setMode] = useButtonAlertColorMode();

  if (!theme.flags.visualDesignRefresh) {
    return null;
  }

  const options: Array<ComboboxOption<ButtonAlertColorMode>> = [
    {
      value: 'same',
      label: t('theme-selector.button-alert-colors.same', 'Same colors for buttons and alerts'),
    },
    {
      value: 'subtleAlert',
      label: t('theme-selector.button-alert-colors.subtle-alert', 'Alerts use a subtler color'),
    },
    {
      value: 'subtleAlertAndOutline',
      label: t(
        'theme-selector.button-alert-colors.subtle-alert-and-outline',
        'Alerts use a subtler color, and outline buttons match it'
      ),
    },
  ];

  return (
    <Field
      label={t('theme-selector.button-alert-colors.label', 'Button & alert colors')}
      description={t(
        'theme-selector.button-alert-colors.description',
        'Design experiment: how solid buttons, outline buttons, and alerts of the same severity share color.'
      )}
      noMargin
    >
      <Combobox options={options} value={mode} onChange={(option) => option && setMode(option.value)} />
    </Field>
  );
}
