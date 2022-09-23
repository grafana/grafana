import { css, cx } from '@emotion/css';
import React, { HTMLProps } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { getFocusStyle, sharedInputStyle } from '../Forms/commonStyles';

export interface Props extends Omit<HTMLProps<HTMLTextAreaElement>, 'size'> {
  /** Show an invalid state around the input */
  invalid?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, Props>(({ invalid, className, ...props }, ref) => {
  const theme = useTheme2();
  const styles = getTextAreaStyle(theme, invalid);

  return <textarea {...props} className={cx(styles.textarea, className)} ref={ref} />;
});

const getTextAreaStyle = stylesFactory((theme: GrafanaTheme2, invalid = false) => {
  return {
    textarea: cx(
      sharedInputStyle(theme),
      getFocusStyle(theme),
      css`
        display: block;
        border-radius: ${theme.shape.borderRadius()};
        padding: ${theme.spacing.gridSize / 4}px ${theme.spacing.gridSize}px;
        width: 100%;
        border-color: ${invalid ? theme.colors.error.border : theme.components.input.borderColor};
      `
    ),
  };
});

TextArea.displayName = 'TextArea';
