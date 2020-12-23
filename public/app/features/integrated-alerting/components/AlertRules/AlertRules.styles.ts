import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ palette, colors, spacing }: GrafanaTheme) => {
  const cellPadding = 16;

  return {
    actionsWrapper: css`
      display: flex;
      justify-content: flex-end;
      margin-bottom: ${spacing.sm};
    `,
    filtersWrapper: css`
      padding: 5px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      margin: 0 -${cellPadding}px;
    `,
    filter: css`
      background-color: ${colors.bg3};
      border-radius: 8px;
      padding: 6px;
      line-height: 1;
      margin: 5px;
    `,
    lastNotifiedWrapper: css`
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
    `,
    lastNotifiedDate: css`
      flex: 1;
    `,
    lastNotifiedCircle: css`
      border-radius: 50%;
      background-color: ${palette.red};
      margin-left: 10px;
      height: 16px;
      width: 16px;
    `,
  };
};
