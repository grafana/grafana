import { css } from '@emotion/css';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';

export function buildTooltipTheme(
  theme: GrafanaTheme2,
  tooltipBg: string,
  toggletipBorder: string,
  tooltipText: string,
  tooltipPadding: { topBottom: number; rightLeft: number }
) {
  return {
    arrow: css`
      height: 1rem;
      width: 1rem;
      position: absolute;
      pointer-events: none;

      &::before {
        border-style: solid;
        content: '';
        display: block;
        height: 0;
        margin: auto;
        width: 0;
      }

      &::after {
        border-style: solid;
        content: '';
        display: block;
        height: 0;
        margin: auto;
        position: absolute;
        width: 0;
      }
    `,
    container: css`
      background-color: ${tooltipBg};
      border-radius: ${theme.shape.radius.default};
      border: 1px solid ${toggletipBorder};
      box-shadow: ${theme.shadows.z2};
      color: ${tooltipText};
      font-size: ${theme.typography.bodySmall.fontSize};
      padding: ${theme.spacing(tooltipPadding.topBottom, tooltipPadding.rightLeft)};
      transition: opacity 0.3s;
      z-index: ${theme.zIndex.tooltip};
      max-width: 400px;
      overflow-wrap: break-word;

      &[data-popper-interactive='false'] {
        pointer-events: none;
      }

      &[data-popper-placement*='bottom'] > div[data-popper-arrow='true'] {
        left: 0;
        margin-top: -7px;
        top: 0;

        &::before {
          border-color: transparent transparent ${toggletipBorder} transparent;
          border-width: 0 8px 7px 8px;
          position: absolute;
          top: -1px;
        }

        &::after {
          border-color: transparent transparent ${tooltipBg} transparent;
          border-width: 0 8px 7px 8px;
        }
      }

      &[data-popper-placement*='top'] > div[data-popper-arrow='true'] {
        bottom: 0;
        left: 0;
        margin-bottom: -14px;

        &::before {
          border-color: ${toggletipBorder} transparent transparent transparent;
          border-width: 7px 8px 0 7px;
          position: absolute;
          top: 1px;
        }

        &::after {
          border-color: ${tooltipBg} transparent transparent transparent;
          border-width: 7px 8px 0 7px;
        }
      }

      &[data-popper-placement*='right'] > div[data-popper-arrow='true'] {
        left: 0;
        margin-left: -10px;

        &::before {
          border-color: transparent ${toggletipBorder} transparent transparent;
          border-width: 7px 6px 7px 0;
        }

        &::after {
          border-color: transparent ${tooltipBg} transparent transparent;
          border-width: 6px 7px 7px 0;
          left: 2px;
          top: 1px;
        }
      }

      &[data-popper-placement*='left'] > div[data-popper-arrow='true'] {
        margin-right: -11px;
        right: 0;

        &::before {
          border-color: transparent transparent transparent ${toggletipBorder};
          border-width: 7px 0 6px 7px;
        }

        &::after {
          border-color: transparent transparent transparent ${tooltipBg};
          border-width: 6px 0 5px 5px;
          left: 1px;
          top: 1px;
        }
      }

      code {
        border: none;
        display: inline;
        background: ${colorManipulator.darken(tooltipBg, 0.1)};
        color: ${tooltipText};
      }

      pre {
        background: ${colorManipulator.darken(tooltipBg, 0.1)};
        color: ${tooltipText};
      }

      a {
        color: ${tooltipText};
        text-decoration: underline;
      }

      a:hover {
        text-decoration: none;
      }
    `,
    headerClose: css`
      color: ${theme.colors.text.secondary};
      position: absolute;
      right: ${theme.spacing(1)};
      top: ${theme.spacing(1.5)};
      background-color: transparent;
      border: 0;
    `,
    header: css`
      padding-top: ${theme.spacing(1)};
      padding-bottom: ${theme.spacing(2)};
    `,
    body: css`
      padding-top: ${theme.spacing(1)};
      padding-bottom: ${theme.spacing(1)};
    `,
    footer: css`
      padding-top: ${theme.spacing(2)};
      padding-bottom: ${theme.spacing(1)};
    `,
  };
}
