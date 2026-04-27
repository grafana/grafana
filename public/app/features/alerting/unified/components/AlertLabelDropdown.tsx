import { css } from '@emotion/css';
import { type FC, forwardRef } from 'react';

import type { SelectableValue } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Field } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

export type AsyncOptionsLoader = (inputValue: string) => Promise<Array<ComboboxOption<string>>>;

export interface AlertLabelDropdownProps {
  onChange: (newValue: SelectableValue<string>) => void;
  onOpenMenu?: () => void;
  options: ComboboxOption[] | AsyncOptionsLoader;
  defaultValue?: SelectableValue;
  type: 'key' | 'value';
  isLoading?: boolean;
}

const AlertLabelDropdown: FC<AlertLabelDropdownProps> = forwardRef<HTMLDivElement, AlertLabelDropdownProps>(
  function LabelPicker({ onChange, options, defaultValue, type, onOpenMenu = () => {}, isLoading = false }, ref) {
    const styles = useStyles2(getStyles);

    const handleChange = (option: ComboboxOption<string> | null) => {
      if (option) {
        onChange({
          label: option.label || option.value,
          value: option.value,
          description: option.description,
        });
      }
    };

    const currentValue = defaultValue
      ? {
          label: defaultValue.label || defaultValue.value,
          value: defaultValue.value,
          description: defaultValue.description,
        }
      : undefined;

    return (
      <div ref={ref}>
        <Field noMargin disabled={false} data-testid={`alertlabel-${type}-picker`} className={styles.resetMargin}>
          <Combobox<string>
            placeholder={t('alerting.alert-label-dropdown.placeholder-select', 'Choose {{type}}', { type })}
            width={25}
            options={options}
            value={currentValue}
            onChange={handleChange}
            createCustomValue={true}
            data-testid={`alertlabel-${type}-combobox`}
          />
        </Field>
      </div>
    );
  }
);

const getStyles = () => ({
  resetMargin: css({ marginBottom: 0 }),
});

export default AlertLabelDropdown;
