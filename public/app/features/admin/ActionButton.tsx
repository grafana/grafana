import React, { FC, useContext } from 'react';
import { css, cx } from 'emotion';
import { ThemeContext, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    button: css`
      text-decoration: underline;
      color: ${theme.colors.blue95};
    `,
  };
});

interface Props {
  text: string;
  className?: string;
  onClick(): void;
}

export const ActionButton: FC<Props> = (props: Props) => {
  const { onClick, text, className } = props;
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);
  const buttonClassName = cx(styles.button);

  return (
    <span className={className}>
      <a type="button" onMouseDown={onClick} className={buttonClassName}>
        {text}
      </a>
    </span>
  );
};
