import React, { FC, HTMLProps } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { Label } from './Label';
import { FieldValidationMessage } from './FieldValidationMessage';
import { selectThemeVariant, stylesFactory, useTheme } from '../../themes';
import { getFocusStyle } from './commonStyles';
import { InputStyles } from './types';
import { Spinner } from '..';
import { Button } from './Button';

interface Props extends HTMLProps<HTMLInputElement> {
  label?: string;
  description?: string;
  invalid?: boolean;
  invalidMessage?: string;
  icon?: string;
  buttonText?: string;
  loading?: boolean;
}

const getInputStyle = stylesFactory(
  (theme: GrafanaTheme, invalid = false, icon = false, loading = false, button = false): InputStyles => {
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
        `,
      (loading || button) &&
        css`
          border-right: 0;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        `
    );

    return {
      input: cx(
        css`
          background-color: ${backgroundColor};
          height: 100%;
          width: 100%
          flex-grow: 1;
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
        flex-grow: 0;
        flex-shrink: 0;
        width: 30px;

        &:first-child {
          border-right: 0;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }

        &:nth-child(3) {
          border-right: 0;
          border-left: 0;
          border-radius: 0;
        }

        &:last-child {
          border-left: 0;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      `,
      inputWithAddonsWrapper: css`
        width: 100%;
        display: flex;
        height: ${height};
      `,
      button: css`
        border-left: 0;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-color: ${borderColor};
      `,
    };
  }
);

export const Input: FC<Props> = props => {
  const { buttonText, description, icon, invalid, invalidMessage, label, loading, ...restProps } = props;

  const theme = useTheme();
  const styles = getInputStyle(theme, invalid, !!icon, loading, !!buttonText);

  return (
    <div>
      {!!label && <Label description={description}>{label}</Label>}
      <div className={styles.inputWithAddonsWrapper}>
        {icon && (
          <div className={styles.addon}>
            <i className={icon} />
          </div>
        )}
        <input className={styles.input} {...restProps} />
        {loading && (
          <div className={styles.addon}>
            <Spinner />
          </div>
        )}
        {!!buttonText && (
          <Button className={styles.button} variant="secondary">
            {buttonText}
          </Button>
        )}
      </div>
      {invalid && invalidMessage && <FieldValidationMessage>{invalidMessage}</FieldValidationMessage>}
    </div>
  );
};
