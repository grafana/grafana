import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => {
  const { colors: v2Colors } = theme;
  const { colors, spacing, border, typography, palette } = theme.v1;
  const checkboxSize = '16px';

  return {
    field: css`
      &:not(:last-child) {
        margin-bottom: ${spacing.formInputMargin};
      }
    `,
    wrapper: css`
      display: flex;
      position: relative;
      padding-left: ${checkboxSize};
      vertical-align: middle;
    `,
    input: css`
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      &:focus + span {
        outline: 2px dotted transparent;
        outline-offset: 2px;
        box-shadow: 0 0 0 2px ${colors.panelBg}, 0 0 0px 4px ${colors.formFocusOutline};
        transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
      }
      &:checked + span {
        background: blue;
        background: ${v2Colors.primary.main};
        border: none;
        &:hover {
          background: ${v2Colors.primary.shade};
        }
        &:after {
          content: '';
          position: absolute;
          left: 5px;
          top: 1px;
          width: 6px;
          height: 12px;
          border: solid ${v2Colors.primary.contrastText};
          border-width: 0 3px 3px 0;
          transform: rotate(45deg);
        }
      }
    `,
    checkmark: css`
      display: inline-block;
      width: ${checkboxSize};
      height: ${checkboxSize};
      border-radius: ${border.radius.sm};
      margin-right: ${spacing.formSpacingBase}px;
      background: ${colors.formInputBg};
      border: 1px solid ${colors.formInputBorder};
      position: absolute;
      top: 2px;
      left: 0;
      &:hover {
        cursor: pointer;
        border-color: ${colors.formInputBorderHover};
      }
    `,
    checkmarkLabel: css`
      margin-left: ${spacing.sm};
    `,
    label: css`
      line-height: ${typography.lineHeight.md};
      margin-bottom: 0;
    `,
    errorMessage: css`
      color: ${palette.red};
      font-size: ${typography.size.sm};
      height: ${typography.size.sm};
      line-height: ${typography.lineHeight.sm};
      margin-top: ${spacing.sm};
      margin-bottom: ${spacing.xs};
    `,
  };
};
