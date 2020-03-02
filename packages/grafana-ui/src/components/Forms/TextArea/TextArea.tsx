import React, { HTMLProps, forwardRef } from 'react';
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

export const TextArea = forwardRef<HTMLTextAreaElement, Props>(({ invalid, size = 'auto', ...props }, ref) => {
  const theme = useTheme();
  const styles = getTextAreaStyle(theme, invalid);

  return (
    <div className={inputSizes()[size]}>
      <textarea ref={ref} className={styles.textarea} {...props} />
    </div>
  );
});
