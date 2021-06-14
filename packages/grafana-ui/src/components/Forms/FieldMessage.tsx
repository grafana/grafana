import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { stylesFactory, useTheme2 } from '../../themes';
import { IconName } from '../../types';

type Message = 'info' | 'alert';

export interface FieldMessageProps {
  children: string;
  /** Override component style */
  className?: string;
  horizontal?: boolean;
  icon: IconName;
  role: Message;
}

export const getFieldMessageStyles = stylesFactory((theme: GrafanaTheme2, color) => {
  const baseStyle = `
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      padding: ${theme.spacing(0.5, 1)};
      color: ${color.contrastText};
      background: ${color.main};
      border-radius: ${theme.shape.borderRadius()};
      position: relative;
      display: inline-block;
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
        border-color: transparent transparent ${color.main} transparent;
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

export const FieldMessage: React.FC<FieldMessageProps> = ({ children, horizontal, className, icon, role }) => {
  const theme = useTheme2();
  const bgColor = role === 'alert' ? 'error' : 'primary';
  const styles = getFieldMessageStyles(theme, theme.colors[bgColor]);
  const cssName = cx(horizontal ? styles.horizontal : styles.vertical, className);

  const ariaRole = role === 'alert' ? { role: 'alert' } : null;
  return (
    <div {...ariaRole} className={cssName}>
      <Icon className={styles.fieldValidationMessageIcon} name={icon} />
      {children}
    </div>
  );
};
