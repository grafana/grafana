import React, { FC, HTMLProps } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { selectThemeVariant, stylesFactory, useTheme } from '../../../themes';
import { getFocusStyle, sharedInputStyle } from '../commonStyles';

export interface Props extends HTMLProps<HTMLTextAreaElement> {
  invalid?: boolean;
}

const getTextAreaStyle = stylesFactory((theme: GrafanaTheme, invalid = false) => {
  const colors = theme.colors;
  const borderColor = invalid
    ? colors.redBase
    : selectThemeVariant({ light: colors.gray4, dark: colors.gray25 }, theme.type);

  return {
    textarea: cx(
      sharedInputStyle(theme),
      getFocusStyle(theme),
      css`
        border: 1px solid ${borderColor};
        border-radius: ${theme.border.radius.sm};
        padding: ${theme.spacing.formSpacingBase / 4}px ${theme.spacing.formSpacingBase}px;
      `
    ),
  };
});

export const TextArea: FC<Props> = ({ invalid, ...props }) => {
  const theme = useTheme();
  const styles = getTextAreaStyle(theme, invalid);

  return <textarea className={styles.textarea} {...props} />;
};
