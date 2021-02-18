import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from '@grafana/ui';

export const getStyles = (theme: GrafanaTheme) => {
  const { border, colors, palette, spacing } = theme;
  const stepHeaderHoverBg = selectThemeVariant(
    { light: palette.gray95, dark: colors.dropdownOptionHoverBg },
    theme.type
  );
  const verticalLineColor = selectThemeVariant({ light: palette.gray4, dark: palette.gray33 }, theme.type);

  return {
    step: css`
      display: flex;
      flex-direction: column;
    `,
    stepHeader: css`
      align-items: center;
      cursor: pointer;
      display: flex;
      padding: ${spacing.lg};
      transition: 0.3s;
      &:hover {
        background-color: ${stepHeaderHoverBg};
      }
    `,
    stepDisabled: css`
      opacity: 0.6;
      pointer-events: none;
    `,
    stepCircle: css`
      align-items: center;
      background-color: ${palette.gray2};
      border-radius: 50%;
      color: ${palette.white};
      display: flex;
      height: ${spacing.lg};
      justify-content: center;
      margin-right: ${spacing.sm};
      transition: 50ms;
      width: ${spacing.lg};
    `,
    stepCircleDone: css`
      background-color: ${palette.brandSuccess};
    `,
    stepCircleCurrent: css`
      background-color: ${palette.brandPrimary};
    `,
    stepCircleInvalid: css`
      background-color: ${palette.brandDanger};
    `,
    stepContentWrapper: css`
      margin-left: ${spacing.xl};
      position: relative;
    `,
    stepContentTransitionWrapper: css`
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.2s ease-in-out;
    `,
    stepContentTransitionCurrent: (height: number) => css`
      label: current;
      max-height: ${height}px;
    `,
    stepContent: css`
      padding: ${spacing.lg};
      padding-top: 0;
    `,
    stepVerticalLine: css`
      &::before {
        bottom: -${spacing.md};
        border-left-color: ${verticalLineColor};
        border-left-width: ${border.width.sm};
        border-left-style: solid;
        content: '';
        height: 100%;
        left: ${spacing.xs};
        min-height: ${spacing.xl};
        position: absolute;
        top: -${spacing.md};
      }
    `,
    stepTitle: css`
      color: ${colors.text};
    `,
  };
};
