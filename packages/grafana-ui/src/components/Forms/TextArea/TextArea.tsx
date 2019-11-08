import React, { FC, HTMLProps } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { selectThemeVariant, stylesFactory, useTheme } from '../../../themes';
import { sharedInputStyle } from '../commonStyles';

export interface Props extends HTMLProps<HTMLTextAreaElement> {
  invalid?: boolean;
}

const getTextAreaStyle = stylesFactory((theme: GrafanaTheme, invalid = false) => {
  const colors = theme.colors;
  const borderColor = selectThemeVariant({ light: colors.gray4, dark: colors.gray25 }, theme.type);
  return {
    textarea: cx(
      sharedInputStyle(theme),
      css`
        border: 1px solid ${borderColor};
        border-radius: ${theme.border.radius.sm};
      `
    ),
  };
});

export const TextArea: FC<Props> = ({ invalid, ...props }) => {
  const theme = useTheme();
  const styles = getTextAreaStyle(theme);

  return <textarea className={styles.textarea} {...props} />;
};
