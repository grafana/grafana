import React, { FC, HTMLProps } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { Label } from './Label';
import { FieldValidationMessage } from './FieldValidationMessage';
import { selectThemeVariant, stylesFactory, useTheme } from '../../themes';
import { getFocusStyle } from './commonStyles';
import { InputStyles } from './types';

interface Props extends HTMLProps<HTMLInputElement> {
  label?: string;
  description?: string;
  invalid?: boolean;
  invalidMessage?: string;
  icon?: string;
}

const getInputStyle = stylesFactory(
  (theme: GrafanaTheme, invalid = false): InputStyles => {
    const colors = theme.colors;

    return {
      input: cx(
        css`
          background-color: ${selectThemeVariant({ light: colors.white, dark: colors.gray15 }, theme.type)};
          border: ${theme.border.width.sm} solid
            ${invalid ? colors.redBase : selectThemeVariant({ light: colors.gray4, dark: colors.gray25 }, theme.type)};
          border-radius: ${theme.border.radius.sm};
          height: ${theme.spacing.formInputHeight};
          padding: 0 ${theme.spacing.formInputPaddingHorizontal};
          margin-bottom: ${invalid ? theme.spacing.formSpacingBase / 2 : theme.spacing.formSpacingBase * 2}px;

          line-height: ${theme.typography.lineHeight.lg};
          font-size: ${theme.typography.size.md};
          color: ${selectThemeVariant({ light: colors.gray25, dark: colors.gray85 }, theme.type)};

          &:hover {
            border-color: ${selectThemeVariant({ light: colors.gray70, dark: colors.gray33 }, theme.type)};
          }

          &:disabled {
            background-color: ${selectThemeVariant({ light: colors.gray6, dark: colors.gray10 }, theme.type)};
            color: ${selectThemeVariant({ light: colors.gray33, dark: colors.gray70 }, theme.type)};
          }
        `,
        getFocusStyle(theme)
      ),
    };
  }
);

export const Input: FC<Props> = props => {
  const { description, icon, invalid, invalidMessage, label, ...restProps } = props;

  const theme = useTheme();
  const styles = getInputStyle(theme, invalid);

  return (
    <div>
      {!!label && <Label description={description}>{label}</Label>}
      <input className={styles.input} {...restProps} />
      {invalid && invalidMessage && <FieldValidationMessage>{invalidMessage}</FieldValidationMessage>}
    </div>
  );
};
