import { css } from '@emotion/css';
import { FC, forwardRef } from 'react';

import { Combobox, ComboboxOption, Field, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface AlertLabelDropdownProps {
  onChange: (newValue: ComboboxOption<string> | null) => void;
  onOpenMenu?: () => void;
  options: Array<ComboboxOption<string>>;
  value?: ComboboxOption<string>;
  type: 'key' | 'value';
}

const AlertLabelDropdown: FC<AlertLabelDropdownProps> = forwardRef<HTMLDivElement, AlertLabelDropdownProps>(
  function LabelPicker({ onChange, options, value, type, onOpenMenu = () => {} }, ref) {
    const styles = useStyles2(getStyles);

    return (
      <div ref={ref}>
        <Field disabled={false} data-testid={`alertlabel-${type}-picker`} className={styles.resetMargin}>
          <Combobox
            placeholder={t('alerting.alert-label-dropdown.placeholder-select', 'Choose {{type}}', { type })}
            width={29}
            onChange={onChange}
            isClearable
            options={options}
            value={value}
            createCustomValue
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
