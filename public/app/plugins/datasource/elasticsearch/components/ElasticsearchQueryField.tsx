import _ from 'lodash';
import React from 'react';

import { QueryField, SlatePrism } from '@grafana/ui';
import { ExploreQueryFieldProps } from '@grafana/data';
import { ElasticDatasource } from '../datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from '../types';

interface Props extends ExploreQueryFieldProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions> {}

interface State {
  syntaxLoaded: boolean;
}

class ElasticsearchQueryField extends React.PureComponent<Props, State> {
  plugins: any[];

  constructor(props: Props, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      SlatePrism({
        onlyIn: (node: any) => node.type === 'code_block',
        getSyntax: (node: any) => 'lucene',
      }),
    ];

    this.state = {
      syntaxLoaded: false,
    };
  }

  componentDidMount() {
    if (!this.props.query.isLogsQuery) {
      this.onChangeQuery('', true);
    }
  }

  componentWillUnmount() {}

  componentDidUpdate(prevProps: Props) {
    // if query changed from the outside (i.e. cleared via explore toolbar)
    if (!this.props.query.isLogsQuery) {
      this.onChangeQuery('', true);
    }
  }

  onChangeQuery = (value: string, override?: boolean) => {
    // Send text change to parent
    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const nextQuery: ElasticsearchQuery = { ...query, query: value, isLogsQuery: true };
      onChange(nextQuery);

      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  render() {
    const { query } = this.props;
    const { syntaxLoaded } = this.state;

    return (
      <>
        <div className="gf-form-inline gf-form-inline--nowrap">
          <div className="gf-form gf-form--grow flex-shrink-1">
            <QueryField
              additionalPlugins={this.plugins}
              query={query.query}
              onChange={this.onChangeQuery}
              onRunQuery={this.props.onRunQuery}
              placeholder="Enter a Lucene query (run with Shift+Enter)"
              portalOrigin="elasticsearch"
              syntaxLoaded={syntaxLoaded}
            />
          </div>
        </div>
      </>
    );
  }
}

export default ElasticsearchQueryField;
