import { css } from '@emotion/css';
import { debounce, intersectionBy, unionBy } from 'lodash';
import { LanguageMap, languages as prismLanguages } from 'prismjs';
import React, { ReactNode } from 'react';
import { Editor, Node, Plugin } from 'slate';

import { AbsoluteTimeRange, QueryEditorProps, SelectableValue } from '@grafana/data';
import {
  BracesPlugin,
  LegacyForms,
  MultiSelect,
  QueryField,
  SlatePrism,
  TypeaheadInput,
  TypeaheadOutput,
} from '@grafana/ui';
import { InputActionMeta } from '@grafana/ui/src/components/Select/types';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { ExploreId } from 'app/types';
// Utils & Services
// dom also includes Element polyfills

import { CloudWatchDatasource } from '../datasource';
import { CloudWatchLanguageProvider } from '../language_provider';
import syntax from '../syntax';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../types';
import { getStatsGroups } from '../utils/query/getStatsGroups';

import QueryHeader from './QueryHeader';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
  exploreId: ExploreId;
  allowCustomValue?: boolean;
}

const containerClass = css`
  flex-grow: 1;
  min-height: 35px;
`;

const rowGap = css`
  gap: 3px;
`;

interface State {
  selectedLogGroups: Array<SelectableValue<string>>;
  availableLogGroups: Array<SelectableValue<string>>;
  loadingLogGroups: boolean;
  invalidLogGroups: boolean;
  hint:
    | {
        message: string;
        fix: {
          label: string;
          action: () => void;
        };
      }
    | undefined;
}

export class CloudWatchLogsQueryField extends React.PureComponent<CloudWatchLogsQueryFieldProps, State> {
  state: State = {
    selectedLogGroups:
      (this.props.query as CloudWatchLogsQuery).logGroupNames?.map((logGroup) => ({
        value: logGroup,
        label: logGroup,
      })) ?? [],
    availableLogGroups: [],
    invalidLogGroups: false,
    loadingLogGroups: false,
    hint: undefined,
  };

  plugins: Plugin[];

  constructor(props: CloudWatchLogsQueryFieldProps, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      BracesPlugin(),
      SlatePrism(
        {
          onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
          getSyntax: (node: Node) => 'cloudwatch',
        },
        { ...(prismLanguages as LanguageMap), cloudwatch: syntax }
      ),
    ];
  }

  fetchLogGroupOptions = async (region: string, logGroupNamePrefix?: string) => {
    try {
      const logGroups: string[] = await this.props.datasource.describeLogGroups({
        refId: this.props.query.refId,
        region,
        logGroupNamePrefix,
      });

      return logGroups.map((logGroup) => ({
        value: logGroup,
        label: logGroup,
      }));
    } catch (err) {
      let errMessage = 'unknown error';
      if (typeof err !== 'string') {
        try {
          errMessage = JSON.stringify(err);
        } catch (e) {}
      } else {
        errMessage = err;
      }
      dispatch(notifyApp(createErrorNotification(errMessage)));
      return [];
    }
  };

  onLogGroupSearch = (searchTerm: string, region: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action !== 'input-change') {
      return Promise.resolve();
    }

    // No need to fetch matching log groups if the search term isn't valid
    // This is also useful for preventing searches when a user is typing out a log group with template vars
    // See https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html for the source of the pattern below
    const logGroupNamePattern = /^[\.\-_/#A-Za-z0-9]+$/;
    if (!logGroupNamePattern.test(searchTerm)) {
      return Promise.resolve();
    }

    this.setState({
      loadingLogGroups: true,
    });

    return this.fetchLogGroupOptions(region, searchTerm)
      .then((matchingLogGroups) => {
        this.setState((state) => ({
          availableLogGroups: unionBy(state.availableLogGroups, matchingLogGroups, 'value'),
        }));
      })
      .finally(() => {
        this.setState({
          loadingLogGroups: false,
        });
      });
  };

  onLogGroupSearchDebounced = debounce(this.onLogGroupSearch, 300);

  componentDidMount = () => {
    const { query, onChange } = this.props;

    this.setState({
      loadingLogGroups: true,
    });

    query.region &&
      this.fetchLogGroupOptions(query.region).then((logGroups) => {
        this.setState((state) => {
          const selectedLogGroups = state.selectedLogGroups;
          if (onChange) {
            const nextQuery = {
              ...query,
              logGroupNames: selectedLogGroups.map((group) => group.value!),
            };

            onChange(nextQuery);
          }

          return {
            loadingLogGroups: false,
            availableLogGroups: logGroups,
            selectedLogGroups,
          };
        });
      });
  };

  onChangeQuery = (value: string) => {
    // Send text change to parent
    const { query, onChange } = this.props;
    const { selectedLogGroups } = this.state;

    if (onChange) {
      const nextQuery = {
        ...query,
        expression: value,
        logGroupNames: selectedLogGroups?.map((logGroupName) => logGroupName.value!) ?? [],
        statsGroups: getStatsGroups(value),
      };
      onChange(nextQuery);
    }
  };

  setSelectedLogGroups = (selectedLogGroups: Array<SelectableValue<string>>) => {
    this.setState({
      selectedLogGroups,
    });

    const { onChange, query } = this.props;
    onChange?.({
      ...(query as CloudWatchLogsQuery),
      logGroupNames: selectedLogGroups.map((logGroupName) => logGroupName.value!) ?? [],
    });
  };

  setCustomLogGroups = (v: string) => {
    const customLogGroup: SelectableValue<string> = { value: v, label: v };
    const selectedLogGroups = [...this.state.selectedLogGroups, customLogGroup];
    this.setSelectedLogGroups(selectedLogGroups);
  };

  onRegionChange = async (v: string) => {
    this.setState({
      loadingLogGroups: true,
    });
    const logGroups = await this.fetchLogGroupOptions(v);
    this.setState((state) => {
      const selectedLogGroups = intersectionBy(state.selectedLogGroups, logGroups, 'value');
      const { onChange, query } = this.props;
      if (onChange) {
        const nextQuery = {
          ...query,
          logGroupNames: selectedLogGroups.map((group) => group.value!),
        };

        onChange(nextQuery);
      }
      return {
        availableLogGroups: logGroups,
        selectedLogGroups: selectedLogGroups,
        loadingLogGroups: false,
      };
    });
  };

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource, query } = this.props;
    const { selectedLogGroups } = this.state;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const cloudwatchLanguageProvider = datasource.languageProvider as CloudWatchLanguageProvider;
    const { history, absoluteRange } = this.props;
    const { prefix, text, value, wrapperClasses, labelKey, editor } = typeahead;

    return await cloudwatchLanguageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey, editor },
      {
        history,
        absoluteRange,
        logGroupNames: selectedLogGroups.map((logGroup) => logGroup.value!),
        region: query.region,
      }
    );
  };

  onQueryFieldClick = (_event: Event, _editor: Editor, next: () => any) => {
    const { selectedLogGroups, loadingLogGroups } = this.state;

    const queryFieldDisabled = loadingLogGroups || selectedLogGroups.length === 0;

    if (queryFieldDisabled) {
      this.setState({
        invalidLogGroups: true,
      });
    }

    next();
  };

  onOpenLogGroupMenu = () => {
    this.setState({
      invalidLogGroups: false,
    });
  };

  render() {
    const { onRunQuery, onChange, ExtraFieldElement, data, query, datasource, allowCustomValue } = this.props;
    const { selectedLogGroups, availableLogGroups, loadingLogGroups, hint, invalidLogGroups } = this.state;

    const showError = data && data.error && data.error.refId === query.refId;
    const cleanText = datasource.languageProvider ? datasource.languageProvider.cleanText : undefined;

    const MAX_LOG_GROUPS = 20;

    return (
      <>
        <QueryHeader
          query={query}
          onRunQuery={onRunQuery}
          datasource={datasource}
          onChange={onChange}
          sqlCodeEditorIsDirty={false}
          onRegionChange={this.onRegionChange}
        />
        <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
          <LegacyForms.FormField
            label="Log Groups"
            labelWidth={6}
            className="flex-grow-1"
            inputEl={
              <MultiSelect
                aria-label="Log Groups"
                menuShouldPortal
                allowCustomValue={allowCustomValue}
                options={unionBy(availableLogGroups, selectedLogGroups, 'value')}
                value={selectedLogGroups}
                onChange={(v) => {
                  this.setSelectedLogGroups(v);
                }}
                onCreateOption={(v) => {
                  this.setCustomLogGroups(v);
                }}
                onBlur={this.props.onRunQuery}
                className={containerClass}
                closeMenuOnSelect={false}
                isClearable={true}
                invalid={invalidLogGroups}
                isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
                placeholder="Choose Log Groups"
                maxVisibleValues={4}
                noOptionsMessage="No log groups available"
                isLoading={loadingLogGroups}
                onOpenMenu={this.onOpenLogGroupMenu}
                onInputChange={(value, actionMeta) => {
                  this.onLogGroupSearchDebounced(value, query.region, actionMeta);
                }}
              />
            }
          />
        </div>
        <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
          <div className="gf-form gf-form--grow flex-shrink-1">
            <QueryField
              additionalPlugins={this.plugins}
              query={(query as CloudWatchLogsQuery).expression ?? ''}
              onChange={this.onChangeQuery}
              onClick={this.onQueryFieldClick}
              onRunQuery={this.props.onRunQuery}
              onTypeahead={this.onTypeahead}
              cleanText={cleanText}
              placeholder="Enter a CloudWatch Logs Insights query (run with Shift+Enter)"
              portalOrigin="cloudwatch"
              disabled={loadingLogGroups || selectedLogGroups.length === 0}
            />
          </div>
          {ExtraFieldElement}
        </div>
        {hint && (
          <div className="query-row-break">
            <div className="text-warning">
              {hint.message}
              <a className="text-link muted" onClick={hint.fix.action}>
                {hint.fix.label}
              </a>
            </div>
          </div>
        )}
        {showError ? (
          <div className="query-row-break">
            <div className="prom-query-field-info text-error">{data?.error?.message}</div>
          </div>
        ) : null}
      </>
    );
  }
}
