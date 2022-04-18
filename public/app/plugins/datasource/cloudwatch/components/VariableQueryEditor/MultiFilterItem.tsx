import { css, cx } from '@emotion/css';
import { GrafanaTheme2, toOption } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/experimental';
import { Input, MultiSelect, stylesFactory, useTheme2 } from '@grafana/ui';
import React, { FunctionComponent, useState } from 'react';
import { MultiFilterCondition } from './MultiFilter';

export interface Props {
  filter: MultiFilterCondition;
  onChange: (value: MultiFilterCondition) => void;
  onDelete: () => void;
}

export const MultiFilterItem: FunctionComponent<Props> = ({ filter, onChange, onDelete }) => {
  const [localKey, setLocalKey] = useState(filter.key || '');
  const [inputValue, setInputValue] = useState('');
  const theme = useTheme2();
  const styles = getOperatorStyles(theme);

  const handleInputChange = (inputValue: string) => {
    setInputValue(inputValue);
  };
  const handleKeyDown = (keyEvent: React.KeyboardEvent) => {
    if (['Tab', 'Enter'].includes(keyEvent.key)) {
      onChange({ ...filter, value: filter.value ? [...filter.value, inputValue] : [inputValue] });
      setInputValue('');
      keyEvent.preventDefault();
    }
  };

  return (
    <div data-testid="cloudwatch-multifilter-item">
      <InputGroup>
        <Input
          aria-label="Filter key"
          id="cloudwatch-multifilter-item-key"
          value={localKey}
          placeholder="key"
          onChange={(e) => setLocalKey(e.currentTarget.value)}
          onBlur={() => {
            if (localKey && localKey !== filter.key) {
              onChange({ key: localKey, value: undefined });
            }
          }}
        />

        <span className={cx(styles.root)}>=</span>

        <MultiSelect
          aria-label="Filter value"
          value={filter.value ? filter.value.map(toOption) : []}
          inputId="cloudwatch-multifilter-item-value"
          inputValue={inputValue}
          allowCustomValue
          onChange={(items) => {
            onChange({ ...filter, value: items.map((item) => item.value ?? '') });
          }}
          onInputChange={handleInputChange}
          onKeyDown={handleKeyDown}
          isOpen={false}
          hideIndicator
          options={filter.value ? filter.value.map(toOption) : []}
          placeholder="value"
        />
        <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} type="button" />
      </InputGroup>
    </div>
  );
};

const getOperatorStyles = stylesFactory((theme: GrafanaTheme2) => ({
  root: css({
    padding: theme.spacing(0, 1),
    alignSelf: 'center',
  }),
}));
