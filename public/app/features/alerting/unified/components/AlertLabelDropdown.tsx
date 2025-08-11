import { css } from '@emotion/css';
import { FC, forwardRef } from 'react';
import { GroupBase, OptionsOrGroups, createFilter } from 'react-select';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, Select, useStyles2 } from '@grafana/ui';

export interface AlertLabelDropdownProps {
  onChange: (newValue: SelectableValue<string>) => void;
  onOpenMenu?: () => void;
  options: SelectableValue[];
  defaultValue?: SelectableValue;
  type: 'key' | 'value';
}
const _customFilter = createFilter({ ignoreCase: false });
function customFilter(opt: SelectableValue, searchQuery: string) {
  return _customFilter(
    {
      label: opt.label ?? '',
      value: opt.value ?? '',
      data: {},
    },
    searchQuery
  );
}

const handleIsValidNewOption = (
  inputValue: string,
  _: SelectableValue<string> | null,
  options: OptionsOrGroups<SelectableValue<string>, GroupBase<SelectableValue<string>>>
) => {
  const exactValueExists = options.some((el) => el.label === inputValue);
  const valueIsNotEmpty = inputValue.trim().length;
  return !Boolean(exactValueExists) && Boolean(valueIsNotEmpty);
};

const AlertLabelDropdown: FC<AlertLabelDropdownProps> = forwardRef<HTMLDivElement, AlertLabelDropdownProps>(
  function LabelPicker({ onChange, options, defaultValue, type, onOpenMenu = () => {} }, ref) {
    const styles = useStyles2(getStyles);

    return (
      <div ref={ref}>
        <Field disabled={false} data-testid={`alertlabel-${type}-picker`} className={styles.resetMargin}>
          <Select<string>
            placeholder={t('alerting.alert-label-dropdown.placeholder-select', 'Choose {{type}}', { type })}
            width={29}
            className="ds-picker select-container"
            backspaceRemovesValue={false}
            onChange={onChange}
            onOpenMenu={onOpenMenu}
            filterOption={customFilter}
            isValidNewOption={handleIsValidNewOption}
            options={options}
            maxMenuHeight={500}
            noOptionsMessage={t('alerting.label-picker.no-options-message', 'No labels found')}
            defaultValue={defaultValue}
            allowCustomValue
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
