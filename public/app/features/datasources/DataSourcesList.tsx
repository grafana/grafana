// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';

// Components
import DataSourcesListItem from './DataSourcesListItem';

// Types
import { DataSourceSettings } from '@grafana/data';
import { List } from '@grafana/ui';
import { LayoutMode, LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

export interface Props {
  dataSources: DataSourceSettings[];
  layoutMode: LayoutMode;
  deleteDataSource: (id: number) => void;
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
        <div className="configuration-card-list-headers">
          <div className="configuration-card-list-headers-column" />
          <div className="configuration-card-list-headers-column">
            <div className="configuration-card-list-headers-column--left">Name</div>
            <div className="configuration-card-list-headers-column--center">URL</div>
            <div className="configuration-card-list-headers-column--right" />
          </div>
        </div>
        <List
          items={dataSources}
          getItemKey={item => item.id.toString()}
          renderItem={item => (
            <DataSourcesListItem
              dataSource={item}
              key={item.id.toString()}
              deleteDataSource={this.props.deleteDataSource}
            />
          )}
        />
      </section>
    );
  }
}

export default DataSourcesList;
