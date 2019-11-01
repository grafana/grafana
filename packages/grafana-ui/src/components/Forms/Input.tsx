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
  (theme: GrafanaTheme, invalid = false, icon = false): InputStyles => {
    const colors = theme.colors;
    const backgroundColor = selectThemeVariant({ light: colors.white, dark: colors.gray15 }, theme.type);
    const borderColor = selectThemeVariant({ light: colors.gray4, dark: colors.gray25 }, theme.type);
    const height = theme.spacing.formInputHeight;
    const borders = cx(
      css`
        border: ${theme.border.width.sm} solid ${invalid ? colors.redBase : borderColor};
        border-radius: ${theme.border.radius.sm};
      `,
      icon &&
        css`
          border-left: 0;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        `
    );

    return {
      input: cx(
        css`
          background-color: ${backgroundColor};
          height: ${height};
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
        getFocusStyle(theme),
        borders
      ),
      addon: css`
        border: 1px solid ${borderColor};
        border-radius: ${theme.border.radius.sm};
        height: ${height};
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: ${backgroundColor};

        &:first-child {
          border-right: 0;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
          width: 30px;
        }

        &:last-child {
          border-left: 0;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      `,
      inputWithAddonsWrapper: css`
        display: flex;
      `,
    };
  }
);

export const Input: FC<Props> = props => {
  const { description, icon, invalid, invalidMessage, label, ...restProps } = props;

  const theme = useTheme();
  const styles = getInputStyle(theme, invalid, !!icon);

  const input = <input className={styles.input} {...restProps} />;
  const inputWithAddons = (
    <div className={styles.inputWithAddonsWrapper}>
      <div className={styles.addon}>
        <i className={icon} />
      </div>
      {input}
    </div>
  );

  return (
    <div>
      {!!label && <Label description={description}>{label}</Label>}
      {!!icon ? inputWithAddons : input}
      {invalid && invalidMessage && <FieldValidationMessage>{invalidMessage}</FieldValidationMessage>}
    </div>
  );
};
