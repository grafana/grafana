import _ from 'lodash';
import React from 'react';
// @ts-ignore
import PluginPrism from 'slate-prism';
// @ts-ignore
import Prism from 'prismjs';

// dom also includes Element polyfills
import QueryField from 'app/features/explore/QueryField';
import { ExploreQueryFieldProps, DataSourceStatus, DataQuery } from '@grafana/ui';
import { ElasticDatasource } from '../datasource';
import { ElasticsearchOptions } from '../types';

export interface ElasticsearchQuery extends DataQuery {
  query: string;
  context: string;
  bucketAggs?: any[];
  metrics?: any[];
  alias?: string;
}

interface Props extends ExploreQueryFieldProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions> {}

interface State {
  syntaxLoaded: boolean;
}

class ElasticsearchQueryField extends React.PureComponent<Props, State> {
  plugins: any[];

  constructor(props: Props, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      PluginPrism({
        onlyIn: (node: any) => node.type === 'code_block',
        getSyntax: (node: any) => 'lucene',
      }),
    ];

    this.state = {
      syntaxLoaded: false,
    };
  }

  componentDidMount() {
    this.onChangeQuery('');
  }

  componentWillUnmount() {}

  componentDidUpdate(prevProps: Props) {
    const reconnected =
      prevProps.datasourceStatus === DataSourceStatus.Disconnected &&
      this.props.datasourceStatus === DataSourceStatus.Connected;
    if (!reconnected) {
      return;
    }
  }

  onChangeQuery = (value: string, override?: boolean) => {
    // Send text change to parent
    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const nextQuery: ElasticsearchQuery = { ...query, query: value, context: 'explore' };
      onChange(nextQuery);

      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  render() {
    const { queryResponse, query } = this.props;
    const { syntaxLoaded } = this.state;

    return (
      <>
        <div className="gf-form-inline gf-form-inline--nowrap">
          <div className="gf-form gf-form--grow flex-shrink-1">
            <QueryField
              additionalPlugins={this.plugins}
              // cleanText={cleanText}
              initialQuery={query.query}
              // onTypeahead={this.onTypeahead}
              // onWillApplySuggestion={willApplySuggestion}
              onChange={this.onChangeQuery}
              onRunQuery={this.props.onRunQuery}
              placeholder="Enter a Lucene query"
              portalOrigin="elasticsearch"
              syntaxLoaded={syntaxLoaded}
            />
          </div>
        </div>
        {queryResponse && queryResponse.error ? (
          <div className="prom-query-field-info text-error">{queryResponse.error.message}</div>
        ) : null}
      </>
    );
  }
}

export default ElasticsearchQueryField;
