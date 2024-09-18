import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2, verticalTabs?: boolean) => ({
  Page: css`
    [class*='page-inner'] {
      background-color: ${theme.colors.background.canvas};
    }

    [class*='page-content'] {
      display: flex;
      flex-direction: ${verticalTabs ? 'row' : 'column'};

      ${theme.breakpoints.down('lg')} {
        ${verticalTabs ? 'flex-direction: column;' : ''}
      }
    }
  `,
  TabsBar: verticalTabs
    ? css`
        width: calc(170px + ${theme.spacing(3)});

        & > div {
          height: auto;
          display: flex;
          align-items: flex-start;
          flex-direction: column;
        }

        [role='tablist'] > div {
          width: 170px;
        }

        ${theme.breakpoints.down('lg')} {
          display: none;
        }
      `
    : '',
  TabSelect: verticalTabs
    ? css`
        width: 200px;
        padding-bottom: ${theme.spacing(1)};

        ${theme.breakpoints.up('lg')} {
          display: none;
        }
      `
    : css`
        display: none;
      `,
  PageBody: css`
    display: flex;
    flex: 1;

    [class*='page-body'] {
      flex: 1;
    }
  `,
});
