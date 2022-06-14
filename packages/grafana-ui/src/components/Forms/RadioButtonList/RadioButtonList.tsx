import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { useStyles2 } from '../../../themes';

import { RadioButtonDot } from './RadioButtonDot';

export interface RadioButtonListProps<T> {
  /** A name of a radio group. Used to group multiple radio inputs into a single group */
  name: string;
  id?: string;
  /** An array of available options */
  options: Array<SelectableValue<T>>;
  value?: T;
  onChange?: (value: T) => void;
  /** Disables all elements in the list */
  disabled?: boolean;
  /** Disables subset of elements in the list. Compares values using the === operator */
  disabledOptions?: T[];
  className?: string;
}

export function RadioButtonList<T>({
  name,
  id,
  options,
  value,
  onChange,
  className,
  disabled,
  disabledOptions = [],
}: RadioButtonListProps<T>) {
  const styles = useStyles2(getStyles);
  const internalId = id ?? uniqueId('radiogroup-list-');

  return (
    <div id={id} className={cx(styles.container, className)} role="radiogroup">
      {options.map((option, index) => {
        const itemId = `${internalId}-${index}`;

        const isChecked = value && value === option.value;
        const isDisabled = disabled || disabledOptions.some((optionValue) => optionValue === option.value);

        const handleChange = () => onChange && option.value && onChange(option.value);

        return (
          <RadioButtonDot
            key={itemId}
            id={itemId}
            name={name}
            label={option.label}
            description={option.description}
            checked={isChecked}
            disabled={isDisabled}
            onChange={handleChange}
          />
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: grid;
    gap: ${theme.spacing(1)};
  `,
});
