import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Alert, Input, useStyles2 } from '@grafana/ui';

import { type CloudWatchDatasource } from '../../datasource';
import { useEnsureVariableHasSingleSelection } from '../../hooks';

import { MultiFilterCondition } from './MultiFilter';

export interface Props {
  filter: MultiFilterCondition;
  onChange: (value: MultiFilterCondition) => void;
  onDelete: () => void;
  keyPlaceholder?: string;
  datasource: CloudWatchDatasource;
}

export const MultiFilterItem = ({ filter, onChange, onDelete, keyPlaceholder, datasource }: Props) => {
  const [localKey, setLocalKey] = useState(filter.key || '');
  const [localValue, setLocalValue] = useState(filter.value?.join(', ') || '');
  const error = useEnsureVariableHasSingleSelection(datasource, filter.key);
  const styles = useStyles2(getOperatorStyles);

  return (
    <div data-testid="cloudwatch-multifilter-item">
      <InputGroup>
        <Input
          data-testid="cloudwatch-multifilter-item-key"
          aria-label="Filter key"
          value={localKey}
          placeholder={keyPlaceholder ?? 'key'}
          onChange={(e) => setLocalKey(e.currentTarget.value)}
          onBlur={() => {
            if (localKey && localKey !== filter.key) {
              onChange({ ...filter, key: localKey });
            }
          }}
        />

        <span className={cx(styles.root)}>=</span>

        <Input
          data-testid="cloudwatch-multifilter-item-value"
          aria-label="Filter value"
          value={localValue}
          placeholder="value1, value2,..."
          onChange={(e) => setLocalValue(e.currentTarget.value)}
          onBlur={() => {
            const newValues = localValue.split(',').map((v) => v.trim());
            if (localValue && newValues !== filter.value) {
              onChange({ ...filter, value: newValues });
            }
            setLocalValue(newValues.join(', '));
          }}
        />

        <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} type="button" />
      </InputGroup>
      {error && <Alert title={error} severity="error" topSpacing={1} />}
    </div>
  );
};

const getOperatorStyles = (theme: GrafanaTheme2) => ({
  root: css({
    padding: theme.spacing(0, 1),
    alignSelf: 'center',
  }),
});
