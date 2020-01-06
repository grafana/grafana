// Libraries
import React, { FunctionComponent, useContext } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, ThemeContext } from '@grafana/ui';

// Components
import DataSourcesListItem from './DataSourcesListItem';

// Types
import { DataSourceSettings } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  tableStyle: css`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 4px;
  `,
  tableHeaderLogo: css`
    min-width: 55px;
    width: 15%;
    margin-left: ${theme.spacing.sm};
    margin-right: ${theme.spacing.lg};
  `,
  tableHeaderName: css`
    width: 30%;
    font-weight: 700;
  `,
  tableHeaderURL: css`
    width: 30%;
    font-weight: 700;
  `,
  tableHeaderActions: css`
    width: 25%;
  `,
}));

export interface Props {
  dataSources: DataSourceSettings[];
  deleteDataSource: (id: number) => void;
}

const DataSourcesList: FunctionComponent<Props> = ({ dataSources, deleteDataSource }) => {
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);

  return (
    <table className={style.tableStyle}>
      <thead>
        <tr>
          <th className={style.tableHeaderLogo}>&nbsp;</th>
          <th className={style.tableHeaderName}>Name</th>
          <th className={style.tableHeaderURL}>URL</th>
          <th className={style.tableHeaderActions} />
        </tr>
      </thead>
      <tbody>
        {dataSources.map(item => (
          <DataSourcesListItem dataSource={item} key={item.id.toString()} deleteDataSource={deleteDataSource} />
        ))}
      </tbody>
    </table>
  );
};

export default DataSourcesList;
