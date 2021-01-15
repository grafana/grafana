import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { useTheme, stylesFactory } from '../../themes';

export interface FieldValidationMessageProps {
  children: string;
  /** Override component style */
  className?: string;
  horizontal?: boolean;
}

export const getFieldValidationMessageStyles = stylesFactory((theme: GrafanaTheme) => {
  const baseStyle = `
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      padding: ${theme.spacing.formValidationMessagePadding};
      color: ${theme.colors.formValidationMessageText};
      background: ${theme.colors.formValidationMessageBg};
      border-radius: ${theme.border.radius.sm};
      position: relative;
      display: inline-block;
    `;

  return {
    vertical: css`
      ${baseStyle}
      margin: ${theme.spacing.formValidationMessageMargin};

      &:before {
        content: '';
        position: absolute;
        left: 9px;
        top: -5px;
        width: 0;
        height: 0;
        border-width: 0 4px 5px 4px;
        border-color: transparent transparent ${theme.colors.formValidationMessageBg} transparent;
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
      margin-right: ${theme.spacing.formSpacingBase}px;
    `,
  };
});

export const FieldValidationMessage: React.FC<FieldValidationMessageProps> = ({ children, horizontal, className }) => {
  const theme = useTheme();
  const styles = getFieldValidationMessageStyles(theme);
  const cssName = cx(horizontal ? styles.horizontal : styles.vertical, className);

  return (
    <div role="alert" className={cssName}>
      <Icon className={styles.fieldValidationMessageIcon} name="exclamation-triangle" />
      {children}
    </div>
  );
};
