import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { useTheme, stylesFactory } from '../../themes';

export interface FieldValidationMessageProps {
  children: string;
  /** Override component style */
  className?: string;
}

export const getFieldValidationMessageStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    fieldValidationMessage: css`
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      margin: ${theme.spacing.formValidationMessageMargin};
      padding: ${theme.spacing.formValidationMessagePadding};
      color: ${theme.colors.formValidationMessageText};
      background: ${theme.colors.formValidationMessageBg};
      border-radius: ${theme.border.radius.sm};
      position: relative;
      display: inline-block;

      &:before {
        content: '';
        position: absolute;
        left: 9px;
        top: -4px;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 4px solid ${theme.colors.formValidationMessageBg};
      }
    `,
    fieldValidationMessageIcon: css`
      margin-right: ${theme.spacing.formSpacingBase}px;
    `,
  };
});

export const FieldValidationMessage: React.FC<FieldValidationMessageProps> = ({ children, className }) => {
  const theme = useTheme();
  const styles = getFieldValidationMessageStyles(theme);

  return (
    <div role="alert" className={cx(styles.fieldValidationMessage, className)}>
      <Icon className={styles.fieldValidationMessageIcon} name="exclamation-triangle" />
      {children}
    </div>
  );
};
