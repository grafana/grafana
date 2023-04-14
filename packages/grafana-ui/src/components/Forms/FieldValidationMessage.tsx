import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';

export interface FieldValidationMessageProps {
  /** Override component style */
  className?: string;
  horizontal?: boolean;
}

export const getFieldValidationMessageStyles = stylesFactory((theme: GrafanaTheme2) => {
  const baseStyle = `
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      padding: ${theme.spacing(0.5, 1)};
      color: ${theme.colors.error.contrastText};
      background: ${theme.colors.error.main};
      border-radius: ${theme.shape.borderRadius()};
      position: relative;
      display: inline-block;
      align-self: flex-start;

      a {
        color: ${theme.colors.error.contrastText};
        text-decoration: underline;
      }

      a:hover {
        text-decoration: none;
      }
    `;

  return {
    vertical: css`
      ${baseStyle}
      margin: ${theme.spacing(0.5, 0, 0, 0)};

      &:before {
        content: '';
        position: absolute;
        left: 9px;
        top: -5px;
        width: 0;
        height: 0;
        border-width: 0 4px 5px 4px;
        border-color: transparent transparent ${theme.colors.error.main} transparent;
        border-style: solid;
      }
    `,
    horizontal: css`
      ${baseStyle}
      margin-left: 10px;

      &:before {
        content: '';
        position: absolute;
        left: -5px;
        top: 9px;
        width: 0;
        height: 0;
        border-width: 4px 5px 4px 0;
        border-color: transparent #e02f44 transparent transparent;
        border-style: solid;
      }
    `,
    fieldValidationMessageIcon: css`
      margin-right: ${theme.spacing()};
    `,
  };
});

export const FieldValidationMessage = ({
  children,
  horizontal,
  className,
}: React.PropsWithChildren<FieldValidationMessageProps>) => {
  const theme = useTheme2();
  const styles = getFieldValidationMessageStyles(theme);
  const cssName = cx(horizontal ? styles.horizontal : styles.vertical, className);

  return (
    <div role="alert" className={cssName}>
      <Icon className={styles.fieldValidationMessageIcon} name="exclamation-triangle" />
      {children}
    </div>
  );
};
