import React, { ButtonHTMLAttributes } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme, Tooltip, selectThemeVariant } from '@grafana/ui';

export type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export const BackButton: React.FC<Props> = props => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Tooltip content="Go back (Esc)" placement="bottom">
      <button className={styles.wrapper} {...props}>
        <i className="gicon gicon-arrow-left" />
      </button>
    </Tooltip>
  );
};

BackButton.displayName = 'BackButton';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const hoverColor = selectThemeVariant({ dark: theme.colors.gray25, light: theme.colors.gray85 }, theme.type);

  return {
    wrapper: css`
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      outline: none;
      box-shadow: none;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;

      .gicon {
        opacity: 0.9;
        font-size: 28px;
      }

      &:hover {
        border-radius: 50%;
        background: ${hoverColor};

        .gicon {
          opacity: 1;
          transition: opacity 0.2s ease-in-out;
        }
      }
    `,
  };
});
