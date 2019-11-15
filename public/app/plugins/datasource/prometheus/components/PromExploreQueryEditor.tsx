import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { FormLabel } from '@grafana/ui';
import { ExploreQueryFieldProps } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions } from '../types';

import PromQueryField from './PromQueryField';
export type Props = ExploreQueryFieldProps<PrometheusDatasource, PromQuery, PromOptions>;

interface State {
  interval: string;
}

export class PromExploreQueryEditor extends PureComponent<Props, State> {
  // Query target to be modified and used for queries
  query: PromQuery;

  constructor(props: Props) {
    super(props);
    const { query } = props;
    this.query = query;
    // Query target properties that are fully controlled inputs
    this.state = {
      // Fully controlled text inputs
      interval: query.interval,
    };
  }

  onFieldChange = (query: PromQuery, override?: any) => {
    this.query.expr = query.expr;
  };

  onIntervalChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const interval = e.currentTarget.value;
    this.query.interval = interval;
    this.setState({ interval });
  };

  onRunQuery = () => {
    const { query } = this;
    this.props.onChange(query);
    this.props.onRunQuery();
  };

  render() {
    const { datasource, query, data, history } = this.props;
    const { interval } = this.state;

    return (
      <div className="gf-form-inline">
        <PromQueryField
          datasource={datasource}
          query={query}
          onRunQuery={this.onRunQuery}
          onChange={this.onFieldChange}
          history={history}
          data={data}
        />

        <div className="gf-form-inline">
          <div className="gf-form">
            <FormLabel width={4}>Step</FormLabel>
            <input
              type="text"
              className="gf-form-input width-6"
              placeholder={'auto'}
              onChange={this.onIntervalChange}
              onBlur={this.onRunQuery}
              value={interval}
            />
          </div>
        </div>
      </div>
    );
  }
}
