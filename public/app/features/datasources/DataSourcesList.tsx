// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';

// Components
import DataSourcesListItem from './DataSourcesListItem';

// Types
import { DataSourceSettings } from '@grafana/ui/src/types';
import { LayoutMode, LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

export interface Props {
  dataSources: DataSourceSettings[];
  layoutMode: LayoutMode;
}

export class DataSourcesList extends PureComponent<Props> {
  render() {
    const { dataSources, layoutMode } = this.props;

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
  }
}

export default DataSourcesList;
