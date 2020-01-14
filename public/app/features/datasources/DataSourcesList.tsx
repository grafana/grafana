// Libraries
import React, { FunctionComponent } from 'react';

// Components
import DataSourcesListItem from './DataSourcesListItem';

// Types
import { DataSourceSettings } from '@grafana/data';

export interface Props {
  dataSources: DataSourceSettings[];
  deleteDataSource: (id: number) => void;
}

const DataSourcesList: FunctionComponent<Props> = ({ dataSources, deleteDataSource }) => {
  return (
    <>
      {dataSources.map(item => (
        <DataSourcesListItem dataSource={item} key={item.id.toString()} deleteDataSource={deleteDataSource} />
      ))}
    </>
  );
};

export default DataSourcesList;
