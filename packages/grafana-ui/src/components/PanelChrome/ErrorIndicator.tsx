import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

interface PanelChromeErrorProps {
  error?: string;
}

export const ErrorIndicator: React.FC<PanelChromeErrorProps> = ({ error }) => {
  const styles = useStyles(getStyles);

  if (!error) {
    return null;
  }

  return (
    <>
      <div className={styles.spacer} />
      <div className={styles.container}>
        <Tooltip theme="error" content={error} placement="top">
          <div className={styles.triangle}>
            <Icon className={styles.icon} name="exclamation"></Icon>
          </div>
        </Tooltip>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      position: absolute;
      left: 0;
      top: 0;
      cursor: pointer;
      width: ${theme.panelHeaderHeight}px;
      height: ${theme.panelHeaderHeight}px;
    `,
    spacer: css`
      width: ${theme.panelHeaderHeight / 2}px;
    `,
    triangle: css`
      height: 0;
      width: 0;
      border-left: ${theme.panelHeaderHeight}px solid ${theme.palette.red88};
      border-right: none;
      border-bottom: ${theme.panelHeaderHeight}px solid transparent;
    `,
    icon: css`
      position: absolute;
      left: 0;
      top: 0;
    `,
  };
};
