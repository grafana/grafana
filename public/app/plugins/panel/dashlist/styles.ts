import { css } from 'emotion';

import { GrafanaTheme } from '@grafana/data';
import { styleMixins, stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  dashlistSectionHeader: css`
    margin-bottom: ${theme.spacing.d};
    color: ${theme.colors.textWeak};
  `,

  dashlistSection: css`
    margin-bottom: ${theme.spacing.d};
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
    color: ${theme.colors.textWeak};
    cursor: pointer;
    z-index: 1;
  `,

  dashlistFolder: css`
    color: ${theme.colors.textWeak};
    font-size: ${theme.typography.size.sm};
    line-height: ${theme.typography.lineHeight.sm};
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
}));
