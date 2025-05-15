import { SelectableValue } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { RadioButtonGroup, Field } from '@grafana/ui';

interface Props {
  selectedTheme: string;
  onChange: (value: string) => void;
  description?: string;
}

export const ThemePicker = ({ selectedTheme = 'current', onChange, description }: Props) => {
  const { t } = useTranslate();

  const themeOptions: Array<SelectableValue<string>> = [
    {
      label: t('share-modal.theme-picker.current', `Current`),
      value: 'current',
    },
    {
      label: t('share-modal.theme-picker.dark', `Dark`),
      value: 'dark',
    },
    {
      label: t('share-modal.theme-picker.light', `Light`),
      value: 'light',
    },
  ];

  return (
    <Field label={t('share-modal.theme-picker.field-name', `Theme`)} description={description}>
      <RadioButtonGroup options={themeOptions} value={selectedTheme} onChange={onChange} />
    </Field>
  );
};
