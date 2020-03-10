// Libraries
import React, { ReactNode } from 'react';

import { QueryField, SlatePrism, Forms, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';

// Utils & Services
// dom also includes Element polyfills
import { Plugin, Node } from 'slate';
import syntax from '../syntax';

// Types
import { ExploreQueryFieldProps, AbsoluteTimeRange, SelectableValue } from '@grafana/data';
import { CloudWatchQuery, CloudWatchLogsQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import Prism from 'prismjs';
import { CloudWatchLanguageProvider } from '../language_provider';

export interface CloudWatchLogsQueryFieldProps extends ExploreQueryFieldProps<CloudWatchDatasource, CloudWatchQuery> {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
}

interface State {
  selectedLogGroups: Array<SelectableValue<string>>;
}

export class CloudWatchLogsQueryField extends React.PureComponent<CloudWatchLogsQueryFieldProps, State> {
  state: State = {
    selectedLogGroups:
      (this.props.query as CloudWatchLogsQuery).logGroupNames?.map(logGroup => ({
        value: logGroup,
        label: logGroup,
      })) ?? [],
  };

  plugins: Plugin[];

  constructor(props: CloudWatchLogsQueryFieldProps, context: React.Context<any>) {
    super(props, context);

    Prism.languages['cloudwatch'] = syntax;
    this.plugins = [
      SlatePrism({
        //onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
        getSyntax: (node: Node) => 'cloudwatch',
      }),
    ];
  }

  onChangeQuery = (value: string, override?: boolean) => {
    // Send text change to parent
    const { query, onChange, onRunQuery } = this.props;
    const { selectedLogGroups } = this.state;

    if (onChange) {
      const nextQuery = {
        ...query,
        expression: value,
        logGroupNames: selectedLogGroups?.map(logGroupName => logGroupName.value) ?? [],
      };
      onChange(nextQuery);

      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  loadAsyncOptions = async (logGroupNamePrefix: string) => {
    const logGroups: string[] = await this.props.datasource.describeLogGroups({
      logGroupNamePrefix,
      refId: this.props.query.refId,
    });

    // setCascaderOptions(
    //   logGroups.map(logGroup => ({
    //     label: logGroup,
    //     value: logGroup,
    //     isLeaf: false,
    //   }))
    // );

    return logGroups.map(logGroup => ({
      value: logGroup,
      label: logGroup,
    }));
  };

  setSelectedLogGroups = (v: Array<SelectableValue<string>>) => {
    this.setState({
      selectedLogGroups: v,
    });
  };

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource } = this.props;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const cloudwatchLanguageProvider = datasource.languageProvider as CloudWatchLanguageProvider;
    const { history, absoluteRange } = this.props;
    const { prefix, text, value, wrapperClasses, labelKey } = typeahead;

    const result = await cloudwatchLanguageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey },
      { history, absoluteRange }
    );

    //console.log('handleTypeahead', wrapperClasses, text, prefix, nextChar, labelKey, result.context);

    return result;
  };

  render() {
    const { ExtraFieldElement, data, query } = this.props;
    const { selectedLogGroups } = this.state;

    const showError = data && data.error && data.error.refId === query.refId;

    //let queryStats: any = {};
    // console.log(data.series);
    // if (
    //   data.series.length &&
    //   data.series[0].meta &&
    //   data.series[0].meta.custom &&
    //   data.series[0].meta.custom['Statistics']
    // ) {
    //   queryStats = data.series[0].meta.custom['Statistics'];
    // }

    const MAX_LOG_GROUPS = 20;

    return (
      <>
        <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
          <div className="gf-form flex-shrink-0">
            <Forms.AsyncMultiSelect
              loadOptions={this.loadAsyncOptions}
              value={selectedLogGroups}
              onChange={v => {
                this.setSelectedLogGroups(v);
              }}
              size="sm"
              closeMenuOnSelect={false}
              isClearable={true}
              isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
              defaultOptions
            />
          </div>
          <div className="gf-form gf-form--grow flex-shrink-1">
            <QueryField
              additionalPlugins={this.plugins}
              query={query.expression}
              onChange={this.onChangeQuery}
              onBlur={this.props.onBlur}
              onRunQuery={this.props.onRunQuery}
              onTypeahead={this.onTypeahead}
              placeholder="Enter a CloudWatch Logs Insights query"
              portalOrigin="cloudwatch"
            />
          </div>
          {ExtraFieldElement}
        </div>
        {/* <div className="query-row-break">
          <div>
            Bytes Scanned: {queryStats['BytesScanned']} Records Matched: {queryStats['RecordsMatched']} Records Scanned:{' '}
            {queryStats['RecordsScanned']}
          </div>
        </div> */}
        {showError ? (
          <div className="query-row-break">
            <div className="prom-query-field-info text-error">{data.error.message}</div>
          </div>
        ) : null}
      </>
    );
  }
}
