import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ComponentSize, Stack, useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

const AlertStateDot = (props: DotStylesProps) => {
  const styles = useStyles2(getDotStyles, props);

  return (
    <Stack direction="row" gap={0.5}>
      <div className={styles.dot} />
    </Stack>
  );
};

interface DotStylesProps {
  state: PromAlertingRuleState;
  includeState?: boolean;
  size?: ComponentSize; // TODO support this
}

const getDotStyles = (theme: GrafanaTheme2, props: DotStylesProps) => {
  const size = theme.spacing(1.25);
  const outlineSize = `calc(${size} / 2.5)`;

  return {
    dot: css`
      width: ${size};
      height: ${size};

      border-radius: 100%;

      background-color: ${theme.colors.secondary.main};
      outline: solid ${outlineSize} ${theme.colors.secondary.transparent};
      margin: ${outlineSize};

      ${props.state === PromAlertingRuleState.Inactive &&
      css`
        background-color: ${theme.colors.success.main};
        outline-color: ${theme.colors.success.transparent};
      `}

      ${props.state === PromAlertingRuleState.Pending &&
      css`
        background-color: ${theme.colors.warning.main};
        outline-color: ${theme.colors.warning.transparent};
      `}

      ${props.state === PromAlertingRuleState.Firing &&
      css`
        background-color: ${theme.colors.error.main};
        outline-color: ${theme.colors.error.transparent};
      `}
    `,
  };
};

export { AlertStateDot };
