import React from 'react';
import { DataFrameView, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

type Props = {
  dashboards: DataFrameView;
};

export const SearchPageDashboardList = ({ dashboards }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.listContainer}>
      {dashboards.map((dash) => (
        <div key={dash.UID}>
          <a href={dash.URL}>{dash.Name}</a>
        </div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  listContainer: css`
    max-height: 300px;
    overflow: scroll;
  `,
});
