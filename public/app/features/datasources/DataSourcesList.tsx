import React, { SFC } from 'react';
import classNames from 'classnames/bind';
import DataSourcesListItem from './DataSourcesListItem';
import { DataSource } from 'app/types';
import { LayoutMode, LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

export interface Props {
  dataSources: DataSource[];
  layoutMode: LayoutMode;
}

const DataSourcesList: SFC<Props> = props => {
  const { dataSources, layoutMode } = props;

  const listStyle = classNames({
    'card-section': true,
    'card-list-layout-grid': layoutMode === LayoutModes.Grid,
    'card-list-layout-list': layoutMode === LayoutModes.List,
  });

  return (
    <section className={listStyle}>
      <ol className="card-list">
        {dataSources.map((dataSource, index) => {
          return <DataSourcesListItem dataSource={dataSource} key={`${dataSource.id}-${index}`} />;
        })}
      </ol>
    </section>
  );
};

export default DataSourcesList;
