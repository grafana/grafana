// Libraries
import React, { FunctionComponent, useContext } from 'react';
import classNames from 'classnames';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, ThemeContext } from '@grafana/ui';

// Components
import DataSourcesListItem from './DataSourcesListItem';

// Types
import { DataSourceSettings } from '@grafana/data';
import { List } from '@grafana/ui';
import { LayoutMode, LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  listHeaders: css`
    display: flex;
    flex-direction: row;
    padding: 0 ${theme.spacing.md};

    @media (max-width: ${theme.breakpoints.md}) {
      display: none;
    }
  `,
  listHeadersColumn: css`
    &:first-child {
      margin-right: ${theme.spacing.lg};
      margin-left: ${theme.spacing.sm};
      width: 55px;
      min-width: 55px;
      flex-basis: 10%;
    }

    &:last-child {
      flex-basis: 90%;
      display: flex;
      font-weight: 700;
    }
  `,
  leftHeaderColumn: css`
    flex-basis: 35%;
    flex-grow: 1;
  `,
  centerHeaderColumn: css`
    flex-basis: 30%;
    flex-grow: 1;
  `,
  rightHeaderColumn: css`
    flex-basis: 30%;
    padding-left: 16px;
  `,
}));

export interface Props {
  dataSources: DataSourceSettings[];
  layoutMode: LayoutMode;
  deleteDataSource: (id: number) => void;
}

const DataSourcesList: FunctionComponent<Props> = ({ dataSources, layoutMode, deleteDataSource }) => {
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);

  const listStyle = classNames({
    'card-section': true,
    'card-list-layout-grid': layoutMode === LayoutModes.Grid,
    'card-list-layout-list': layoutMode === LayoutModes.List,
  });

  return (
    <section className={listStyle}>
      <div className={style.listHeaders}>
        <div className={style.listHeadersColumn} />
        <div className={style.listHeadersColumn}>
          <div className={style.leftHeaderColumn}>Name</div>
          <div className={style.centerHeaderColumn}>URL</div>
          <div className={style.rightHeaderColumn} />
        </div>
      </div>
      <List
        items={dataSources}
        getItemKey={item => item.id.toString()}
        renderItem={item => (
          <DataSourcesListItem dataSource={item} key={item.id.toString()} deleteDataSource={deleteDataSource} />
        )}
      />
    </section>
  );
};

export default DataSourcesList;
