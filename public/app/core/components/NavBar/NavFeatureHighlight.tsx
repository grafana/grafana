import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

export interface Props {
  children: JSX.Element;
  text: string;
}

export const NavFeatureHighlight = ({ children, text }: Props): JSX.Element => {
  const styles = useStyles2(getIconStyles);
  return (
    <div className={styles.icon}>
      {children}
      <span className={styles.badge}>
        {text} <i />
      </span>
      <span className={styles.highlight} />
    </div>
  );
};

const getIconStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css`
      position: relative;

      :hover > span {
        visibility: visible;
        opacity: 1;
      }
    `,
    badge: css`
      top: 50%;
      left: 100%;
      transform: translate(0, -50%);
      padding: 4px 8px;
      color: ${theme.colors.text.maxContrast};
      background-color: ${theme.colors.success.main};
      border-radius: 2px;
      position: absolute;
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.2s;
      line-height: 1;

      i {
        position: absolute;
        top: 50%;
        right: 100%;
        transform: translateY(-50%);
        width: 7px;
        height: 24px;
        overflow: hidden;
      }

      i::after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        left: 0;
        top: 50%;
        opacity: 1;
        transform: translate(50%, -50%) rotate(-45deg);
        background-color: ${theme.colors.success.main};
      }
    `,
    highlight: css`
      background-color: ${theme.colors.success.main};
      border-radius: 50%;
      width: 6px;
      height: 6px;
      display: inline-block;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    `,
  };
};
