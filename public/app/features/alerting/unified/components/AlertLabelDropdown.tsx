import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select, Field } from '@grafana/ui';

export interface AlertLabelDropdownProps {
  onChange: (newValue: SelectableValue<string>) => void;
  onOpenMenu?: () => void;
  options: SelectableValue[];
  defaultValue?: SelectableValue;
  type: 'key' | 'value';
}

const AlertLabelDropdown: FC<AlertLabelDropdownProps> = React.forwardRef<HTMLDivElement, AlertLabelDropdownProps>(
  function labelPicker({ onChange, options, defaultValue, type, onOpenMenu = () => {} }, ref) {
    return (
      <div ref={ref}>
        <Field disabled={false} data-testid={`alertlabel-${type}-picker`}>
          <Select
            placeholder={`Choose ${type}`}
            width={29}
            className="ds-picker select-container"
            backspaceRemovesValue={false}
            onChange={onChange}
            onOpenMenu={onOpenMenu}
            options={options}
            maxMenuHeight={500}
            noOptionsMessage="No labels found"
            defaultValue={defaultValue}
            allowCustomValue
          />
        </Field>
      </div>
    );
  }
);

export default AlertLabelDropdown;
