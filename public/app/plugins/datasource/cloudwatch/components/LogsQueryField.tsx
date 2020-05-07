// Libraries
import React, { ReactNode } from 'react';
import intersection from 'lodash/intersection';

import {
  QueryField,
  SlatePrism,
  LegacyForms,
  TypeaheadInput,
  TypeaheadOutput,
  BracesPlugin,
  Select,
  MultiSelect,
} from '@grafana/ui';

// Utils & Services
// dom also includes Element polyfills
import { Plugin, Node, Editor } from 'slate';
import syntax from '../syntax';

// Types
import { ExploreQueryFieldProps, AbsoluteTimeRange, SelectableValue, ExploreMode, AppEvents } from '@grafana/data';
import { CloudWatchQuery, CloudWatchLogsQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import Prism, { Grammar } from 'prismjs';
import { CloudWatchLanguageProvider } from '../language_provider';
import { css } from 'emotion';
import { ExploreId } from 'app/types';
import { dispatch } from 'app/store/store';
import { changeModeAction } from 'app/features/explore/state/actionTypes';
import { appEvents } from 'app/core/core';

export interface CloudWatchLogsQueryFieldProps extends ExploreQueryFieldProps<CloudWatchDatasource, CloudWatchQuery> {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
  syntaxLoaded: boolean;
  syntax: Grammar;
  exploreId: ExploreId;
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
  regions: Array<SelectableValue<string>>;
  selectedRegion: SelectableValue<string>;
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
      (this.props.query as CloudWatchLogsQuery).logGroupNames?.map(logGroup => ({
        value: logGroup,
        label: logGroup,
      })) ?? [],
    availableLogGroups: [],
    regions: [],
    invalidLogGroups: false,
    selectedRegion: (this.props.query as CloudWatchLogsQuery).region
      ? {
          label: (this.props.query as CloudWatchLogsQuery).region,
          value: (this.props.query as CloudWatchLogsQuery).region,
          text: (this.props.query as CloudWatchLogsQuery).region,
        }
      : { label: 'default', value: 'default', text: 'default' },
    loadingLogGroups: false,
    hint: undefined,
  };

  plugins: Plugin[];

  constructor(props: CloudWatchLogsQueryFieldProps, context: React.Context<any>) {
    super(props, context);

    Prism.languages['cloudwatch'] = syntax;
    this.plugins = [
      BracesPlugin(),
      SlatePrism({
        onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
        getSyntax: (node: Node) => 'cloudwatch',
      }),
    ];
  }

  fetchLogGroupOptions = async (region: string) => {
    try {
      const logGroups: string[] = await this.props.datasource.describeLogGroups({
        refId: this.props.query.refId,
        region,
      });

      return logGroups.map(logGroup => ({
        value: logGroup,
        label: logGroup,
      }));
    } catch (err) {
      appEvents.emit(AppEvents.alertError, [err]);
      return [];
    }
  };

  componentWillMount = () => {
    const { datasource, query } = this.props;

    this.setState({
      loadingLogGroups: true,
    });

    this.fetchLogGroupOptions(query.region).then(logGroups => {
      this.setState({
        loadingLogGroups: false,
        availableLogGroups: logGroups,
      });
    });

    datasource.getRegions().then(regions => {
      this.setState({
        regions,
      });
    });
  };

  onChangeQuery = (value: string, override?: boolean) => {
    // Send text change to parent
    const { query, onChange, onRunQuery, datasource, exploreMode } = this.props;
    const { selectedLogGroups, selectedRegion } = this.state;

    // TEMP: Remove when logs/metrics unification is complete
    if (datasource.languageProvider && exploreMode === ExploreMode.Logs) {
      const cloudwatchLanguageProvider = datasource.languageProvider as CloudWatchLanguageProvider;
      const queryUsesStatsCommand = cloudwatchLanguageProvider.isStatsQuery(query.expression);

      if (queryUsesStatsCommand) {
        this.setState({
          hint: {
            message: 'You are trying to run a stats query in Logs mode. ',
            fix: {
              label: 'Switch to Metrics mode.',
              action: this.switchToMetrics,
            },
          },
        });
      } else {
        this.setState({
          hint: undefined,
        });
      }
    }

    if (onChange) {
      const nextQuery = {
        ...query,
        expression: value,
        logGroupNames: selectedLogGroups?.map(logGroupName => logGroupName.value) ?? [],
        region: selectedRegion.value,
      };
      onChange(nextQuery);

      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  setSelectedLogGroups = (v: Array<SelectableValue<string>>) => {
    this.setState({
      selectedLogGroups: v,
    });

    const { onChange, query } = this.props;

    if (onChange) {
      const nextQuery = {
        ...query,
        logGroupNames: v.map(logGroupName => logGroupName.value) ?? [],
      };

      onChange(nextQuery);
    }
  };

  setSelectedRegion = async (v: SelectableValue<string>) => {
    this.setState({
      selectedRegion: v,
      loadingLogGroups: true,
    });

    const logGroups = await this.fetchLogGroupOptions(v.value!);

    this.setState(state => {
      const selectedLogGroups = intersection(state.selectedLogGroups, logGroups);

      const { onChange, query } = this.props;
      if (onChange) {
        const nextQuery = {
          ...query,
          region: v.value,
          logGroupNames: selectedLogGroups.map(group => group.value),
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
    const { datasource } = this.props;
    const { selectedLogGroups } = this.state;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const cloudwatchLanguageProvider = datasource.languageProvider as CloudWatchLanguageProvider;
    const { history, absoluteRange } = this.props;
    const { prefix, text, value, wrapperClasses, labelKey, editor } = typeahead;

    const result = await cloudwatchLanguageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey, editor },
      { history, absoluteRange, logGroupNames: selectedLogGroups.map(logGroup => logGroup.value!) }
    );

    return result;
  };

  switchToMetrics = () => {
    const { query, onChange, exploreId } = this.props;

    if (onChange) {
      const nextQuery: CloudWatchLogsQuery = {
        ...(query as CloudWatchLogsQuery),
        apiMode: 'Logs',
      };
      onChange(nextQuery);
    }

    dispatch(changeModeAction({ exploreId, mode: ExploreMode.Metrics }));
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
    const { ExtraFieldElement, data, query, syntaxLoaded, datasource } = this.props;
    const {
      selectedLogGroups,
      availableLogGroups,
      regions,
      selectedRegion,
      loadingLogGroups,
      hint,
      invalidLogGroups,
    } = this.state;

    const showError = data && data.error && data.error.refId === query.refId;
    const cleanText = datasource.languageProvider ? datasource.languageProvider.cleanText : undefined;

    const MAX_LOG_GROUPS = 20;

    return (
      <>
        <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
          <LegacyForms.FormField
            label="Region"
            labelWidth={4}
            inputEl={
              <Select
                options={regions}
                value={selectedRegion}
                onChange={v => this.setSelectedRegion(v)}
                width={18}
                placeholder="Choose Region"
                menuPlacement="bottom"
                maxMenuHeight={500}
              />
            }
          />

          <LegacyForms.FormField
            label="Log Groups"
            labelWidth={6}
            className="flex-grow-1"
            inputEl={
              <MultiSelect
                options={availableLogGroups}
                value={selectedLogGroups}
                onChange={v => {
                  this.setSelectedLogGroups(v);
                }}
                className={containerClass}
                closeMenuOnSelect={false}
                isClearable={true}
                invalid={invalidLogGroups}
                isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
                placeholder="Choose Log Groups"
                maxVisibleValues={4}
                menuPlacement="bottom"
                noOptionsMessage="No log groups available"
                isLoading={loadingLogGroups}
                onOpenMenu={this.onOpenLogGroupMenu}
              />
            }
          />
        </div>
        <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
          <div className="gf-form gf-form--grow flex-shrink-1">
            <QueryField
              additionalPlugins={this.plugins}
              query={query.expression}
              onChange={this.onChangeQuery}
              onBlur={this.props.onBlur}
              onClick={this.onQueryFieldClick}
              onRunQuery={this.props.onRunQuery}
              onTypeahead={this.onTypeahead}
              cleanText={cleanText}
              placeholder="Enter a CloudWatch Logs Insights query"
              portalOrigin="cloudwatch"
              syntaxLoaded={syntaxLoaded}
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
