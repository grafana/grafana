import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup, Field } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props {
  selectedTheme: string;
  onChange: (value: string) => void;
  description?: string;
}

export const ThemePicker = ({ selectedTheme = 'current', onChange, description }: Props) => {
  //BMC Accessibility Change next few lines : Added aria-labels to options
  const themeOptions: Array<SelectableValue<string>> = [
    {
      label: t('share-modal.theme-picker.current', `Current`),
      value: 'current',
      ariaLabel: t('bmc.share-modal.theme-picker.current-theme', `Current theme`),
    },
    {
      label: t('share-modal.theme-picker.dark', `Dark`),
      value: 'dark',
      ariaLabel: t('bmc.share-modal.theme-picker.dark-theme', `Dark theme`),
    },
    {
      label: t('share-modal.theme-picker.light', `Light`),
      value: 'light',
      ariaLabel: t('bmc.share-modal.theme-picker.light-theme', `Light theme`),
    },
    //BMC Accessibility Change end
  ];

  return (
    //BMC Accessibility Changes next few lines: added htmlFor,id & aria-label
    <Field label={t('share-modal.theme-picker.field-name', `Theme`)} description={description} htmlFor="theme-picker">
      <RadioButtonGroup
        id="theme-picker"
        options={themeOptions}
        value={selectedTheme}
        onChange={onChange}
        aria-label={t('share-modal.theme-picker.field-name', `Theme`)}
      />
    </Field>
    //BMC Accessibility Change end
  );
};
