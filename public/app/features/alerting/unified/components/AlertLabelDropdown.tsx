import { css } from '@emotion/css';
import { FC, forwardRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, ComboboxOption, Field, useStyles2 } from '@grafana/ui';

export interface AlertLabelDropdownProps {
  onChange: (newValue: SelectableValue<string>) => void;
  onOpenMenu?: () => void;
  options: ComboboxOption[];
  defaultValue?: SelectableValue;
  type: 'key' | 'value';
  isLoading?: boolean;
  fetchOptions?: (inputValue: string) => Promise<ComboboxOption[]>;
}

const AlertLabelDropdown: FC<AlertLabelDropdownProps> = forwardRef<HTMLDivElement, AlertLabelDropdownProps>(
  function LabelPicker(
    { onChange, options, defaultValue, type, onOpenMenu = () => {}, isLoading = false, fetchOptions },
    ref
  ) {
    const styles = useStyles2(getStyles);

    // Create async options function if fetchOptions is provided, otherwise use static options
    const asyncOptions = fetchOptions || options;

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
        <Field disabled={false} data-testid={`alertlabel-${type}-picker`} className={styles.resetMargin}>
          <Combobox<string>
            placeholder={t('alerting.alert-label-dropdown.placeholder-select', 'Choose {{type}}', { type })}
            width={25}
            options={asyncOptions}
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
