import { css } from '@emotion/css';
import React from 'react';

import { Select, HorizontalGroup, Input, useStyles2 } from '@grafana/ui';

import { TraceqlFilter } from '../dataquery.gen';

import { operatorSelectableValue } from './utils';

interface Props {
  filter: TraceqlFilter;
  updateFilter: (f: TraceqlFilter) => void;
  isTagsLoading?: boolean;
  operators: string[];
}

const validationRegex = /^\d+(?:\.\d)?\d*(?:us|µs|ns|ms|s|m|h)$/;

const getStyles = () => ({
  noBoxShadow: css`
    box-shadow: none;
    *:focus {
      box-shadow: none;
    }
  `,
});

const DurationInput = ({ filter, operators, updateFilter }: Props) => {
  const styles = useStyles2(getStyles);

  let invalid = false;
  if (typeof filter.value === 'string') {
    invalid = filter.value ? !validationRegex.test(filter.value.concat('')) : false;
  }

  return (
    <HorizontalGroup spacing={'none'}>
      <Select
        className={styles.noBoxShadow}
        inputId={`${filter.id}-operator`}
        options={operators.map(operatorSelectableValue)}
        value={filter.operator}
        onChange={(v) => {
          updateFilter({ ...filter, operator: v?.value });
        }}
        isClearable={false}
        aria-label={`select ${filter.id} operator`}
        allowCustomValue={true}
        width={8}
      />
      <Input
        className={styles.noBoxShadow}
        value={filter.value}
        onChange={(v) => {
          updateFilter({ ...filter, value: v.currentTarget.value });
        }}
        placeholder="e.g. 100ms, 1.2s"
        aria-label={`select ${filter.id} value`}
        invalid={invalid}
        width={18}
      />
    </HorizontalGroup>
  );
};

export default DurationInput;
