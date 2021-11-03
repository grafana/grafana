import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ border, colors, spacing, typography }: GrafanaTheme) => ({
  navigationButton: css`
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    padding-bottom: 1.2em;
    margin: ${spacing.sm};
    border-radius: ${border.radius.md};
    width: 230px;
    height: 160px;
    text-align: center;
    background-color: transparent;
    border: ${border.width.sm} dashed ${colors.border2};

    :hover {
      cursor: pointer;
      background-color: ${colors.dropdownOptionHoverBg};
      border: ${border.width.sm} solid ${colors.border2};
    }
  `,
  navigationPanel: css`
    display: flex;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    max-width: 800px;
    width: 100%;
    overflow: hidden;
  `,
  content: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 2em;
  `,
  addInstance: css`
    margin-top: ${spacing.sm};
    font-size: ${typography.size.sm};
  `,
  addInstanceTitle: css`
    margin-top: ${spacing.sm};
    overflow: hidden;
    line-height: ${typography.lineHeight.md};
    width: 65%;
    height: 3em;
  `,
});
