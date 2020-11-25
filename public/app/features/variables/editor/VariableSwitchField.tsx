import React, { ChangeEvent, PropsWithChildren, ReactElement } from 'react';
import { InlineField, Switch, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

interface VariableSwitchFieldProps {
  value: boolean;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  tooltip?: string;
  ariaLabel?: string;
}

export function VariableSwitchField({
  value,
  name,
  tooltip,
  onChange,
  ariaLabel,
}: PropsWithChildren<VariableSwitchFieldProps>): ReactElement {
  const styles = useStyles(getStyles);

  return (
    <InlineField label={name} labelWidth={20} tooltip={tooltip}>
      <div aria-label={ariaLabel} className={styles.switchContainer}>
        <Switch label={name} value={value} onChange={onChange} />
      </div>
    </InlineField>
  );
}

function getStyles(theme: GrafanaTheme) {
  return {
    switchContainer: css`
      margin-left: ${theme.spacing.sm};
      margin-right: ${theme.spacing.sm};
    `,
  };
}
