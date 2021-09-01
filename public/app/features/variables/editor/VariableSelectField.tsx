import React, { PropsWithChildren, ReactElement } from 'react';
import { InlineFormLabel, Select, useStyles } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';

interface VariableSelectFieldProps<T> {
  name: string;
  value: SelectableValue<T>;
  options: Array<SelectableValue<T>>;
  onChange: (option: SelectableValue<T>) => void;
  tooltip?: string;
  ariaLabel?: string;
  width?: number;
  labelWidth?: number;
}

export function VariableSelectField({
  name,
  value,
  options,
  tooltip,
  onChange,
  ariaLabel,
  width,
  labelWidth,
}: PropsWithChildren<VariableSelectFieldProps<any>>): ReactElement {
  const styles = useStyles(getStyles);

  return (
    <>
      <InlineFormLabel width={labelWidth ?? 6} tooltip={tooltip}>
        {name}
      </InlineFormLabel>
      <div aria-label={ariaLabel}>
        <Select
          menuShouldPortal
          onChange={onChange}
          value={value}
          width={width ?? 25}
          options={options}
          className={styles.selectContainer}
        />
      </div>
    </>
  );
}

function getStyles(theme: GrafanaTheme) {
  return {
    selectContainer: css`
      margin-right: ${theme.spacing.xs};
    `,
  };
}
