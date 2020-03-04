import React, { HTMLProps } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '../../../themes';
import { getFocusStyle, inputSizes, sharedInputStyle } from '../commonStyles';
import { FormInputSize } from '../types';

export interface Props extends Omit<HTMLProps<HTMLTextAreaElement>, 'size'> {
  /** Show an invalid state around the input */
  invalid?: boolean;
  /** Choose a predefined size */
  size?: FormInputSize;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, Props>(({ invalid, size = 'auto', ...props }, ref) => {
  const theme = useTheme();
  const styles = getTextAreaStyle(theme, invalid);

  return (
    <div className={inputSizes()[size]}>
      <textarea className={styles.textarea} {...props} ref={ref} />
    </div>
  );
});

const getTextAreaStyle = stylesFactory((theme: GrafanaTheme, invalid = false) => {
  return {
    textarea: cx(
      sharedInputStyle(theme),
      getFocusStyle(theme),
      css`
        border-radius: ${theme.border.radius.sm};
        padding: ${theme.spacing.formSpacingBase / 4}px ${theme.spacing.formSpacingBase}px;
        width: 100%;
      `
    ),
  };
});
