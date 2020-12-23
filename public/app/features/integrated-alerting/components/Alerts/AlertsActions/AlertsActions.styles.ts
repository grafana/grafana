import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => {
  const size = 16;

  const hoverColor = theme.isLight ? theme.palette.gray95 : theme.palette.gray15;

  // TODO: remove the button styles and use an IconButton once implemented as part of the @percona/platform-core library
  return {
    button: css`
      width: ${size}px;
      height: ${size}px;
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      outline: none;
      box-shadow: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 0;
      margin-right: ${theme.spacing.xs};

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        opacity: 0.65;
        box-shadow: none;
      }

      &:before {
        content: '';
        display: block;
        opacity: 1;
        position: absolute;
        transition-duration: 0.2s;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        z-index: -1;
        bottom: -8px;
        left: -8px;
        right: -8px;
        top: -8px;
        background: none;
        border-radius: 50%;
        box-sizing: border-box;
        transform: scale(0);
        transition-property: transform, opacity;
      }

      &:hover {
        color: ${theme.colors.linkHover};

        &:before {
          background-color: ${hoverColor};
          border: none;
          box-shadow: none;
          opacity: 1;
          transform: scale(0.8);
        }
      }
    `,
    actionsWrapper: css`
      display: flex;
      justify-content: center;
    `,
  };
};
