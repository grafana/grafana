import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { styleMixins } from '@grafana/ui';

export const getStyles = (theme: GrafanaTheme2) => ({
  dashlistSectionHeader: css`
    margin-bottom: ${theme.spacing(2)};
    color: ${theme.colors.secondary.text};
  `,

  dashlistSection: css`
    margin-bottom: ${theme.spacing(2)};
    padding-top: 3px;
  `,

  dashlistLink: css`
    ${styleMixins.listItem(theme)}
    display: flex;
    cursor: pointer;
    margin: 3px;
    padding: 7px;
  `,

  dashlistStar: css`
    display: flex;
    align-items: center;
    color: ${theme.colors.secondary.text};
    cursor: pointer;
    z-index: 1;
  `,

  dashlistFolder: css`
    color: ${theme.colors.secondary.text};
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: ${theme.typography.body.lineHeight};
  `,

  dashlistTitle: css`
    &::after {
      position: absolute;
      content: '';
      left: 0;
      top: 0;
      bottom: 0;
      right: 0;
    }
  `,

  dashlistLinkBody: css`
    flex-grow: 1;
  `,

  dashlistItem: css`
    position: relative;
    list-style: none;
  `,
});
