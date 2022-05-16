import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { useStyles2 } from '../../../themes';

import { RadioButtonDot } from './RadioButtonDot';

export interface RadioButtonListProps<T> {
  name: string;
  value?: T;
  id?: string;
  idSelector: (option: T) => string;
  disabled?: boolean;
  disabledOptions?: T[];
  options: Array<SelectableValue<T>>;
  onChange?: (value: T) => void;
  className?: string;
}

export function RadioButtonList<T>({
  name,
  options,
  value,
  idSelector,
  onChange,
  className,
  disabled,
  disabledOptions = [],
}: RadioButtonListProps<T>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.container, className)}>
      {options.map((option) => (
        <RadioButtonDot
          key={idSelector(option.value!)}
          id={idSelector(option.value!)} // TODO Fix null assertion
          name={name}
          label={option.label}
          checked={value && value === option.value}
          disabled={disabled || disabledOptions.some((optionValue) => optionValue === option.value)}
          onClick={() => onChange && option.value && onChange(option.value)}
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
