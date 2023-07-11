import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ComponentSize, Tooltip, useStyles2 } from '@grafana/ui';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

const AlertStateDot = (props: DotStylesProps) => {
  const styles = useStyles2((theme) => getDotStyles(theme, props));

  return (
    <Tooltip content={String(props.state)} placement="top">
      <div className={styles.dot} />
    </Tooltip>
  );
};

interface DotStylesProps {
  state?: GrafanaAlertState;
  size?: ComponentSize; // TODO support this
}

const getDotStyles = (theme: GrafanaTheme2, props: DotStylesProps) => {
  const size = theme.spacing(1.25);

  return {
    dot: css`
      width: ${size};
      height: ${size};

      border-radius: 100%;

      background-color: ${theme.colors.secondary.main};
      outline: solid calc(${size} / 2.5) ${theme.colors.secondary.transparent};

      ${props.state === GrafanaAlertState.Normal &&
      css`
        background-color: ${theme.colors.success.main};
        outline-color: ${theme.colors.success.transparent};
      `}

      ${props.state === GrafanaAlertState.Pending &&
      css`
        background-color: ${theme.colors.warning.main};
        outline-color: ${theme.colors.warning.transparent};
      `}

      ${props.state === GrafanaAlertState.Alerting &&
      css`
        background-color: ${theme.colors.error.main};
        outline-color: ${theme.colors.error.transparent};
      `}
    `,
  };
};

export { AlertStateDot };
