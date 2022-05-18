import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { useStyles2 } from '../../../themes';

import { RadioButtonDot } from './RadioButtonDot';

export interface RadioButtonListProps<T> {
  name: string;
  id?: string;
  options: Array<SelectableValue<T>>;
  keySelector: (option: T) => string;
  value?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  disabledOptions?: T[];
  className?: string;
}

export function RadioButtonList<T>({
  name,
  id,
  options,
  keySelector,
  value,
  onChange,
  className,
  disabled,
  disabledOptions = [],
}: RadioButtonListProps<T>) {
  const styles = useStyles2(getStyles);

  return (
    <div id={id} className={cx(styles.container, className)}>
      {options.map((option) => (
        <RadioButtonDot
          key={keySelector(option.value!)}
          id={keySelector(option.value!)} // TODO Fix null assertion
          name={name}
          label={option.label}
          checked={value && value === option.value}
          disabled={disabled || disabledOptions.some((optionValue) => optionValue === option.value)}
          onChange={() => onChange && option.value && onChange(option.value)}
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: grid;
    gap: ${theme.spacing(0.5)};
  `,
});
