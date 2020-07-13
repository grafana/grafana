// Libraries
import React, { PureComponent } from 'react';

// @ts-ignore ignoring this for now, otherwise we would have to extend _ interface with move
import _ from 'lodash';

// Types
import { PanelModel } from '../state/PanelModel';
import { DataQuery, PanelData, DataSourceSelectItem } from '@grafana/data';
import { DashboardModel } from '../state/DashboardModel';
import { QueryEditorRow } from './QueryEditorRow';
import { addQuery } from 'app/core/utils/query';

interface Props {
  // The query configuration
  queries: DataQuery[];
  datasource: DataSourceSelectItem;

  // Query editing
  onChangeQueries: (queries: DataQuery[]) => void;
  onScrollBottom: () => void;

  // Dashboard Configs
  panel: PanelModel;
  dashboard: DashboardModel;

  // Query Response Data
  data: PanelData;
}

export class QueryEditorRows extends PureComponent<Props> {
  onAddQuery = (query?: Partial<DataQuery>) => {
    const { queries, onChangeQueries } = this.props;
    onChangeQueries(addQuery(queries, query));
    this.props.onScrollBottom();
  };

  onRemoveQuery = (query: DataQuery) => {
    const { queries, onChangeQueries, panel } = this.props;
    const removed = queries.filter(q => {
      return q !== query;
    });
    onChangeQueries(removed);
    panel.refresh();
  };

  onMoveQuery = (query: DataQuery, direction: number) => {
    const { queries, onChangeQueries, panel } = this.props;

    const index = _.indexOf(queries, query);
    // @ts-ignore
    _.move(queries, index, index + direction);
    onChangeQueries(queries);
    panel.refresh();
  };

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onChangeQueries } = this.props;

    const old = queries[index];

    // ensure refId & datasource are maintained
    query.refId = old.refId;
    if (old.datasource) {
      query.datasource = old.datasource;
    }

    // update query in array
    onChangeQueries(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return query;
        }
        return item;
      })
    );
  }

  render() {
    const { props } = this;
    return props.queries.map((query, index) => (
      <QueryEditorRow
        dataSourceValue={query.datasource || props.datasource.value}
        key={query.refId}
        panel={props.panel}
        dashboard={props.dashboard}
        data={props.data}
        query={query}
        onChange={query => this.onChangeQuery(query, index)}
        onRemoveQuery={this.onRemoveQuery}
        onAddQuery={this.onAddQuery}
        onMoveQuery={this.onMoveQuery}
        inMixedMode={props.datasource.meta.mixed}
      />
    ));
  }
}
