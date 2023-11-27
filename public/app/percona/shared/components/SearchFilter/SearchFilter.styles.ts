import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
    justify-content: space-between;
    align-items: center;
    margin-bottom: -${theme.spacing(2)};
  `,
  filtersContainer: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
  `,
  filter: css`
    width: 150px;
  `,
  searchBar: css`
    width: 50%;
  `,
});
