import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

export interface FieldValidationMessageProps {
  /** Override component style */
  className?: string;
  horizontal?: boolean;
}

export const FieldValidationMessage = ({
  children,
  horizontal,
  className,
}: React.PropsWithChildren<FieldValidationMessageProps>) => {
  const styles = useStyles2(getFieldValidationMessageStyles);
  const cssName = cx(horizontal ? styles.horizontal : styles.vertical, className);

  return (
    <div role="alert" className={cssName}>
      <Icon className={styles.fieldValidationMessageIcon} name="exclamation-triangle" />
      {children}
    </div>
  );
};

export const getFieldValidationMessageStyles = (theme: GrafanaTheme2) => {
  const baseStyle = `
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      padding: ${theme.spacing(0.5, 1)};
      color: ${theme.colors.error.contrastText};
      background: ${theme.colors.error.main};
      border-radius: ${theme.shape.radius.default};
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
    vertical: css(baseStyle, {
      margin: theme.spacing(0.5, 0, 0, 0),

      '&:before': {
        content: '""',
        position: 'absolute',
        left: '9px',
        top: '-5px',
        width: 0,
        height: 0,
        borderWidth: '0 4px 5px 4px',
        borderColor: `transparent transparent ${theme.colors.error.main} transparent`,
        borderStyle: 'solid',
      },
    }),
    horizontal: css(baseStyle, {
      marginLeft: '10px',

      '&:before': {
        content: '""',
        position: 'absolute',
        left: '-5px',
        top: '9px',
        width: 0,
        height: 0,
        borderWidth: '4px 5px 4px 0',
        borderColor: 'transparent #e02f44 transparent transparent',
        borderStyle: 'solid',
      },
    }),
    fieldValidationMessageIcon: css({
      marginRight: theme.spacing(),
    }),
  };
};
