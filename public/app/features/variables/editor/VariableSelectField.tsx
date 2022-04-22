import { css } from '@emotion/css';
import React, { PropsWithChildren, ReactElement } from 'react';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { InlineFormLabel, Select, useStyles } from '@grafana/ui';
import { useUniqueId } from 'app/plugins/datasource/influxdb/components/useUniqueId';

interface VariableSelectFieldProps<T> {
  name: string;
  value: SelectableValue<T>;
  options: Array<SelectableValue<T>>;
  onChange: (option: SelectableValue<T>) => void;
  tooltip?: string;
  testId?: string;
  width?: number;
  labelWidth?: number;
}

export function VariableSelectField({
  name,
  value,
  options,
  tooltip,
  onChange,
  testId,
  width,
  labelWidth,
}: PropsWithChildren<VariableSelectFieldProps<any>>): ReactElement {
  const styles = useStyles(getStyles);
  const uniqueId = useUniqueId();
  const inputId = `variable-select-input-${name}-${uniqueId}`;

  return (
    <>
      <InlineFormLabel width={labelWidth ?? 6} tooltip={tooltip} htmlFor={inputId}>
        {name}
      </InlineFormLabel>
      <div data-testid={testId}>
        <Select
          inputId={inputId}
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
