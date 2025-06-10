import { css, cx } from '@emotion/css';
import { forwardRef, HTMLProps } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyle, sharedInputStyle } from '../Forms/commonStyles';

export interface Props extends Omit<HTMLProps<HTMLTextAreaElement>, 'size'> {
  /** Show an invalid state around the input */
  invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, Props>(({ invalid, className, ...props }, ref) => {
  const styles = useStyles2(getTextAreaStyle, invalid);

  return <textarea {...props} className={cx(styles.textarea, className)} ref={ref} />;
});

const getTextAreaStyle = (theme: GrafanaTheme2, invalid = false) => ({
  textarea: cx(
    sharedInputStyle(theme),
    getFocusStyle(theme),
    css({
      display: 'block',
      borderRadius: theme.shape.radius.default,
      padding: `${theme.spacing.gridSize / 4}px ${theme.spacing.gridSize}px`,
      width: '100%',
      borderColor: invalid ? theme.colors.error.border : theme.components.input.borderColor,
    })
  ),
});

TextArea.displayName = 'TextArea';
