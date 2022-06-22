import {css} from '@emotion/css';
import {debounce, intersectionBy, unionBy} from 'lodash';
import React, {ReactNode, useState, useEffect} from 'react';
import {Editor} from 'slate';

import {AbsoluteTimeRange, QueryEditorProps, SelectableValue} from '@grafana/data';
import {LegacyForms, MultiSelect, QueryField, TypeaheadInput, TypeaheadOutput} from '@grafana/ui';
import {InputActionMeta} from '@grafana/ui/src/components/Select/types';
import {notifyApp} from 'app/core/actions';
import {createErrorNotification} from 'app/core/copy/appNotification';
import {dispatch} from 'app/store/store';
import {ExploreId} from 'app/types';

// Utils & Services
// dom also includes Element polyfills
import {CloudWatchDatasource} from '../datasource';
import {CloudWatchLanguageProvider} from "../language_provider";
import {CloudWatchJsonData, CloudWatchQuery, CloudWatchLogsQuery} from '../types';
import {getStatsGroups} from '../utils/query/getStatsGroups';
import {appendTemplateVariables} from '../utils/utils';

import QueryHeader from './QueryHeader';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
  exploreId: ExploreId;
  allowCustomValue?: boolean;
}

interface Hint {
  message: string;
  fix: Fix;
}

interface Fix {
  label: string;
  action: () => void;
}

const containerClass = css`
  flex-grow: 1;
  min-height: 35px;
`;

const rowGap = css`
  gap: 3px;
`;

// plugins: Plugin[];
//
// constructor(props: CloudWatchLogsQueryFieldProps, context: React.Context<any>) {
//   super(props, context);
//
//   this.plugins = [
//     BracesPlugin(),
//     SlatePrism(
//       {
//         onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
//         getSyntax: (node: Node) => 'cloudwatch',
//       },
//       { ...(prismLanguages as LanguageMap), cloudwatch: syntax }
//     ),
//   ];
// }
//

export const CloudWatchLogsQueryField = (props: CloudWatchLogsQueryFieldProps) => {
  const {onRunQuery, onChange, ExtraFieldElement, query, data, datasource, allowCustomValue} = props;
  const [selectedLogGroups, setSelectedLogGroups] = useState<Array<SelectableValue<string>>>(
    (props.query as CloudWatchLogsQuery).logGroupNames?.map((logGroup) => ({
      value: logGroup,
      label: logGroup,
    })) ?? []
  );
  const [availableLogGroups, setAvailableLogGroups] = useState<Array<SelectableValue<string>>>([]);
  const [invalidLogGroups, setInvalidLogGroups] = useState(false);
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);
  const [hint] = useState<Hint | undefined>(undefined);

  const showError = data && data.error && data.error.refId === query.refId;
  const cleanText = datasource.languageProvider ? datasource.languageProvider.cleanText : undefined;

  const MAX_LOG_GROUPS = 20;

  const fetchLogGroupOptions = async (region: string, logGroupNamePrefix?: string) => {
    try {
      const logGroups: string[] = await props.datasource.describeLogGroups({
        refId: props.query.refId,
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
        } catch (e) {
        }
      } else {
        errMessage = err;
      }
      dispatch(notifyApp(createErrorNotification(errMessage)));
      return [];
    }
  };

  const onLogGroupSearch = (searchTerm: string, region: string, actionMeta: InputActionMeta) => {
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

    setLoadingLogGroups(true);

    return fetchLogGroupOptions(region, searchTerm)
      .then((matchingLogGroups) => {
        setAvailableLogGroups(unionBy(availableLogGroups, matchingLogGroups, 'value'))
      })
      .finally(() => {
        setLoadingLogGroups(false);
      });
  };

  const onLogGroupSearchDebounced = debounce(onLogGroupSearch, 300);

  useEffect(() => {
    const {query, onChange} = props;

    setLoadingLogGroups(true)

    query.region &&
    fetchLogGroupOptions(query.region).then((logGroups) => {
      const resultSelectedLogGroups = selectedLogGroups;
      if (onChange) {
        const nextQuery = {
          ...query,
          logGroupNames: resultSelectedLogGroups.map((group) => group.value!),
        };

        onChange(nextQuery);
      }

      setLoadingLogGroups(false);
      setAvailableLogGroups(logGroups);
      setSelectedLogGroups(resultSelectedLogGroups);
    });
  });

  const setCustomLogGroups = (v: string) => {
    const customLogGroup: SelectableValue<string> = {value: v, label: v};
    const combinedSelectedLogGroups = [...selectedLogGroups, customLogGroup];
    setSelectedLogGroups(combinedSelectedLogGroups);
  };

  const onChangeQuery = (value: string) => {
    // Send text change to parent
    const {query, onChange} = props;

    if (onChange) {
      const nextQuery = {
        ...query,
        expression: value,
        logGroupNames: selectedLogGroups.map((logGroupName) => logGroupName.value!) ?? [],
        statsGroups: getStatsGroups(value),
      };
      onChange(nextQuery);
    }
  };

  const setSelectedLogGroupsFunc = (selectedLogGroups: Array<SelectableValue<string>>) => {
    setSelectedLogGroups(selectedLogGroups)

    const {onChange, query} = props;
    onChange?.({
      ...(query as CloudWatchLogsQuery),
      logGroupNames: selectedLogGroups.map((logGroupName) => logGroupName.value!) ?? [],
    });
  };

  const onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const {datasource, query} = props;

    if (!datasource.languageProvider) {
      return {suggestions: []};
    }

    const cloudwatchLanguageProvider = datasource.languageProvider as CloudWatchLanguageProvider;
    const {history, absoluteRange} = props;
    const {prefix, text, value, wrapperClasses, labelKey, editor} = typeahead;

    return await cloudwatchLanguageProvider.provideCompletionItems(
      {text, value, prefix, wrapperClasses, labelKey, editor},
      {
        history,
        absoluteRange,
        logGroupNames: selectedLogGroups.map((logGroup) => logGroup.value!),
        region: query.region,
      }
    );
  };


  const onRegionChange = async (v: string) => {
    setLoadingLogGroups(true);
    const logGroups = await fetchLogGroupOptions(v);
    const resultingSelectedLogGroups = intersectionBy(selectedLogGroups, logGroups, 'value');
    const {onChange, query} = props;
    if (onChange) {
      const nextQuery = {
        ...query,
        logGroupNames: resultingSelectedLogGroups.map((group) => group.value!),
      };

      onChange(nextQuery);
    }
    setAvailableLogGroups(logGroups);
    setSelectedLogGroups(resultingSelectedLogGroups)
    setLoadingLogGroups(false);
  };

  const onQueryFieldClick = (_event: Event, _editor: Editor, next: () => any) => {
    const queryFieldDisabled = loadingLogGroups || selectedLogGroups.length === 0;

    if (queryFieldDisabled) {
      setInvalidLogGroups(true)
    }

    next();
  };


  const onOpenLogGroupMenu = () => {
    setInvalidLogGroups(false);
  };

  return (
    <>
      <QueryHeader
        query={query}
        onRunQuery={onRunQuery}
        datasource={datasource}
        onChange={onChange}
        sqlCodeEditorIsDirty={false}
        onRegionChange={onRegionChange}
      />
      <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
        <LegacyForms.FormField
          label="Log Groups"
          labelWidth={6}
          className="flex-grow-1"
          inputEl={
            <MultiSelect
              aria-label="Log Groups"
              allowCustomValue={allowCustomValue}
              options={appendTemplateVariables(datasource, unionBy(availableLogGroups, selectedLogGroups, 'value'))}
              value={selectedLogGroups}
              onChange={(v) => {
                setSelectedLogGroupsFunc(v);
              }}
              onCreateOption={(v) => {
                setCustomLogGroups(v);
              }}
              onBlur={props.onRunQuery}
              className={containerClass}
              closeMenuOnSelect={false}
              isClearable={true}
              invalid={invalidLogGroups}
              isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
              placeholder="Choose Log Groups"
              maxVisibleValues={4}
              noOptionsMessage="No log groups available"
              isLoading={loadingLogGroups}
              onOpenMenu={onOpenLogGroupMenu}
              onInputChange={(value, actionMeta) => {
                onLogGroupSearchDebounced(value, query.region, actionMeta);
              }}
            />
          }
        />
      </div>
      <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
        <div className="gf-form gf-form--grow flex-shrink-1">
          <QueryField
            additionalPlugins={plugins}
            query={(query as CloudWatchLogsQuery).expression ?? ''}
            onChange={onChangeQuery}
            onClick={onQueryFieldClick}
            onRunQuery={props.onRunQuery}
            onTypeahead={onTypeahead}
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
};

