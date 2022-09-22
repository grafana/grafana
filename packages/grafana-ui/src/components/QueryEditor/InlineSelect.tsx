import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { GroupBase } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { Select } from '../Select/Select';
import { SelectContainerProps, SelectContainer as BaseSelectContainer } from '../Select/SelectContainer';
import { SelectCommonProps } from '../Select/types';

interface InlineSelectProps<T> extends SelectCommonProps<T> {
  label?: string;
}

export function InlineSelect<T>({ label: labelProp, ...props }: InlineSelectProps<T>) {
  const theme = useTheme2();
  const [id] = useState(() => Math.random().toString(16).slice(2));
  const styles = getSelectStyles(theme);
  const components = {
    SelectContainer,
    ValueContainer,
    SingleValue: ValueContainer,
  };

  return (
    <div className={styles.root}>
      {labelProp && (
        <label className={styles.label} htmlFor={id}>
          {labelProp}
          {':'}&nbsp;
        </label>
      )}
      {/* @ts-ignore */}
      <Select openMenuOnFocus inputId={id} {...props} components={components} />
    </div>
  );
}

const SelectContainer = <Option, isMulti extends boolean, Group extends GroupBase<Option>>(
  props: SelectContainerProps<Option, isMulti, Group>
) => {
  const { children } = props;

  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  return (
    <BaseSelectContainer {...props} className={cx(props.className, styles.container)}>
      {children}
    </BaseSelectContainer>
  );
};

const ValueContainer = <Option, isMulti extends boolean, Group extends GroupBase<Option>>(
  props: SelectContainerProps<Option, isMulti, Group>
) => {
  const { className, children } = props;
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  return <div className={cx(className, styles.valueContainer)}>{children}</div>;
};

const getSelectStyles = stylesFactory((theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    fontSize: 12,
    alignItems: 'center',
  }),

  label: css({
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),

  container: css({
    background: 'none',
    borderColor: 'transparent',
  }),

  valueContainer: css({
    display: 'flex',
    alignItems: 'center',
    flex: 'initial',
    color: theme.colors.text.secondary,
    fontSize: 12,
  }),
}));
