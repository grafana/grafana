import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { palette, colors }, visualization }: GrafanaTheme2) => ({
  TooltipWrapper: css`
    padding: 0.5em;
  `,
  TooltipHeader: css`
    border-bottom: 1px solid ${palette.gray2};
    padding: 0em 0.5em;
    margin-bottom: 0.5em;
  `,
  TooltipBody: css`
    padding: 0em 0.5em;
    font-weight: normal;
  `,
  InfoIcon: css`
    color: ${visualization.getColorByName('cornflowerblue')};
  `,
  FailedDiv: css`
    margin-right: 0.5em;
    font-size: 30px;
  `,
  Green: css`
    color: ${palette.greenBase};
  `,
  Empty: css`
    text-align: center;
  `,
  Link: css`
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
  Critical: css`
    color: ${palette.red};
  `,
  Error: css`
    color: ${palette.orange};
  `,
  Warning: css`
    color: ${palette.yellow};
  `,
  Notice: css`
    color: ${palette.blue80};
  `,
});
