import React, { FC, HTMLProps } from 'react';
import { css } from 'emotion';
import { getTheme, selectThemeVariant, stylesFactory } from '../../themes';
import { GrafanaTheme } from '../../types';

interface Props extends HTMLProps<HTMLInputElement> {}

const getInputStyle = stylesFactory((theme: GrafanaTheme) => {
  const colors = theme.colors;

  return {
    input: css`
      background-color: ${selectThemeVariant({ light: colors.white, dark: colors.gray15 }, theme.type)};
      border: ${theme.border.width.sm} solid
        ${selectThemeVariant({ light: colors.gray4, dark: colors.gray25 }, theme.type)};
      border-radius: ${theme.border.radius.sm};
      height: ${theme.spacing.formInputHeight};
      padding: 0 ${theme.spacing.formInputPaddingHorizontal};
      margin-top: ${theme.spacing.formSpacingBase / 2}px;
      margin-bottom: ${theme.spacing.formSpacingBase * 2}px;

      line-height: ${theme.typography.lineHeight.lg};
      font-size: ${theme.typography.size.md};
      color: ${selectThemeVariant({ light: colors.gray25, dark: colors.gray85 }, theme.type)}

      &[hover],
      &:hover {
        border-color: ${colors.gray33};
      }
    `,
  };
});

export const Input: FC<Props> = props => {
  const theme = getTheme();
  const styles = getInputStyle(theme);

  return <input type={props.type} className={styles.input} />;
};
