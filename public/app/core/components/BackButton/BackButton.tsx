import React, { ButtonHTMLAttributes } from 'react';
import { css } from 'emotion';
import { stylesFactory } from '@grafana/ui';
import { Tooltip } from '@grafana/ui';

export type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export const BackButton: React.FC<Props> = props => {
  const styles = getIconStyles();
  return (
    <Tooltip content="Go back (Esc)" placement="bottom">
      <button className={styles.wrapper} {...props}>
        <i className="gicon gicon-arrow-left-circle" />
      </button>
    </Tooltip>
  );
};

BackButton.displayName = 'Icon';

const getIconStyles = stylesFactory(() => {
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

      .gicon {
        opacity: 0.9;
        font-size: 35px;
      }

      &:hover {
        .gicon {
          opacity: 1;
          transition: opacity 0.2s ease-in-out;
        }
      }
    `,
  };
});
