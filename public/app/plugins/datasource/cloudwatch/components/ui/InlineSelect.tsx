import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Select, stylesFactory, useTheme2 } from '@grafana/ui';
import {
  ContainerProps,
  SelectContainer as BaseSelectContainer,
} from '@grafana/ui/src/components/Select/SelectContainer';
import { SelectCommonProps } from '@grafana/ui/src/components/Select/types';
import React, { useState } from 'react';
import { GroupTypeBase } from 'react-select';

interface InlineSelectProps<T> extends SelectCommonProps<T> {
  label?: string;
}

function InlineSelect<T>({ label: labelProp, ...props }: InlineSelectProps<T>) {
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
      <Select openMenuOnFocus inputId={id} {...props} width="auto" components={components} />
    </div>
  );
}

export default InlineSelect;

const SelectContainer = <Option, isMulti extends boolean, Group extends GroupTypeBase<Option>>(
  props: ContainerProps<Option, isMulti, Group>
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

const ValueContainer = <Option, isMulti extends boolean, Group extends GroupTypeBase<Option>>(
  props: ContainerProps<Option, isMulti, Group>
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
