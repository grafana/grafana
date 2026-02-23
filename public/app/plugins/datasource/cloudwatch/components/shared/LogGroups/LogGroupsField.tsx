import { useEffect, useState } from 'react';

import { EditorField, EditorRow } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Box, Stack } from '@grafana/ui';

import { LogGroup, LogGroupClass, LogsQueryLanguage, LogsQueryScope } from '../../../dataquery.gen';
import { CloudWatchDatasource } from '../../../datasource';
import { useAccountOptions, useIsMonitoringAccount } from '../../../hooks';
import { DescribeLogGroupsRequest } from '../../../resources/types';
import { isTemplateVariable } from '../../../utils/templateVariableUtils';

import { AccountsSelector } from './AccountsSelector';
import { LegacyLogGroupSelection } from './LegacyLogGroupNamesSelection';
import { LogGroupClassSelector } from './LogGroupClassSelector';
import { LogGroupPrefixInput } from './LogGroupPrefixInput';
import { LogGroupQueryScopeSelector } from './LogGroupQueryScopeSelector';
import { LogGroupsSelector } from './LogGroupsSelector';
import { SelectedLogGroups } from './SelectedLogGroups';

type Props = {
  datasource: CloudWatchDatasource;
  onChange: (logGroups: LogGroup[]) => void;
  legacyLogGroupNames?: string[];
  logGroups?: LogGroup[];
  region: string;
  maxNoOfVisibleLogGroups?: number;
  onBeforeOpen?: () => void;
  showQueryScopeSelector?: boolean;
  queryLanguage?: LogsQueryLanguage;
  logsQueryScope?: LogsQueryScope;
  onLogsQueryScopeChange?: (scope: LogsQueryScope) => void;
  logGroupPrefixes?: string[];
  onLogGroupPrefixesChange?: (prefixes: string[]) => void;
  logGroupClass?: LogGroupClass;
  onLogGroupClassChange?: (logGroupClass: LogGroupClass) => void;
  selectedAccountIds?: string[];
  onSelectedAccountIdsChange?: (accountIds: string[]) => void;
};

export const LogGroupsField = ({
  datasource,
  onChange,
  legacyLogGroupNames,
  logGroups,
  region,
  maxNoOfVisibleLogGroups,
  onBeforeOpen,
  showQueryScopeSelector,
  queryLanguage,
  logsQueryScope,
  onLogsQueryScopeChange,
  logGroupPrefixes,
  onLogGroupPrefixesChange,
  logGroupClass,
  onLogGroupClassChange,
  selectedAccountIds,
  onSelectedAccountIdsChange,
}: Props) => {
  const accountState = useAccountOptions(datasource?.resources, region);
  const isMonitoringAccount = useIsMonitoringAccount(datasource?.resources, region);
  const [loadingLogGroupsStarted, setLoadingLogGroupsStarted] = useState(false);

  const effectiveScope = logsQueryScope ?? 'logGroupName';
  const shouldShowQueryScopeSelector =
    showQueryScopeSelector ?? (queryLanguage === LogsQueryLanguage.CWLI || queryLanguage === undefined);

  useEffect(() => {
    // If log group names are stored in the query model, make a new DescribeLogGroups request for each log group to load the arn. Then update the query model.
    if (datasource && !loadingLogGroupsStarted && !logGroups?.length && legacyLogGroupNames?.length) {
      setLoadingLogGroupsStarted(true);

      const variables = legacyLogGroupNames.filter((lgn) => isTemplateVariable(datasource.resources.templateSrv, lgn));
      const legacyLogGroupNameValues = legacyLogGroupNames.filter(
        (lgn) => !isTemplateVariable(datasource.resources.templateSrv, lgn)
      );

      Promise.all(
        legacyLogGroupNameValues.map((lg) =>
          datasource.resources.getLogGroups({ region: region, logGroupNamePrefix: lg })
        )
      )
        .then((results) => {
          const logGroups = results.flatMap((r) =>
            r.map((lg) => ({
              arn: lg.value.arn,
              name: lg.value.name,
              accountId: lg.accountId,
            }))
          );

          onChange([...logGroups, ...variables.map((v) => ({ name: v, arn: v }))]);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, [datasource, legacyLogGroupNames, logGroups, onChange, region, loadingLogGroupsStarted]);

  const renderLogGroupNameMode = () => (
    <Stack direction="column" gap={1}>
      <LogGroupsSelector
        fetchLogGroups={async (params: Partial<DescribeLogGroupsRequest>) =>
          datasource?.resources.getLogGroups({ region: region, ...params }) ?? []
        }
        onChange={onChange}
        accountOptions={accountState.value}
        selectedLogGroups={logGroups}
        onBeforeOpen={onBeforeOpen}
        variables={datasource?.getVariables()}
      />
      <SelectedLogGroups
        selectedLogGroups={logGroups ?? []}
        onChange={onChange}
        maxNoOfVisibleLogGroups={maxNoOfVisibleLogGroups}
      />
    </Stack>
  );

  const renderPrefixFields = () => (
    <Stack direction="row" gap={2} wrap="wrap" alignItems="flex-start">
      <LogGroupPrefixInput
        prefixes={logGroupPrefixes ?? []}
        onChange={onLogGroupPrefixesChange ?? (() => {})}
        variables={datasource?.getVariables()}
      />
      <LogGroupClassSelector value={logGroupClass} onChange={onLogGroupClassChange ?? (() => {})} />
      {isMonitoringAccount && (
        <AccountsSelector
          accountOptions={accountState.value ?? []}
          selectedAccountIds={selectedAccountIds}
          onChange={onSelectedAccountIdsChange ?? (() => {})}
        />
      )}
    </Stack>
  );

  const renderAllLogGroupsFields = () => (
    <Stack direction="row" gap={2} wrap="wrap" alignItems="flex-start">
      <LogGroupClassSelector value={logGroupClass} onChange={onLogGroupClassChange ?? (() => {})} />
      {isMonitoringAccount && (
        <AccountsSelector
          accountOptions={accountState.value ?? []}
          selectedAccountIds={selectedAccountIds}
          onChange={onSelectedAccountIdsChange ?? (() => {})}
        />
      )}
    </Stack>
  );

  if (!shouldShowQueryScopeSelector) {
    return (
      <Box marginTop={1} marginBottom={1}>
        {renderLogGroupNameMode()}
      </Box>
    );
  }

  return (
    <Box marginTop={1} marginBottom={1}>
      <Stack direction="column" gap={1}>
        <EditorRow>
          <EditorField label="Query scope">
            <LogGroupQueryScopeSelector value={effectiveScope} onChange={onLogsQueryScopeChange ?? (() => {})} />
          </EditorField>
        </EditorRow>

        {effectiveScope === 'logGroupName' && renderLogGroupNameMode()}
        {effectiveScope === 'namePrefix' && renderPrefixFields()}
        {effectiveScope === 'allLogGroups' && renderAllLogGroupsFields()}
      </Stack>
    </Box>
  );
};

type WrapperProps = {
  datasource: CloudWatchDatasource;
  onChange: (logGroups: LogGroup[]) => void;
  legacyLogGroupNames?: string[];
  logGroups?: LogGroup[];
  region: string;
  maxNoOfVisibleLogGroups?: number;
  onBeforeOpen?: () => void;
  showQueryScopeSelector?: boolean;

  legacyOnChange: (logGroups: string[]) => void;

  queryLanguage?: LogsQueryLanguage;
  logsQueryScope?: LogsQueryScope;
  onLogsQueryScopeChange?: (scope: LogsQueryScope) => void;
  logGroupPrefixes?: string[];
  onLogGroupPrefixesChange?: (prefixes: string[]) => void;
  logGroupClass?: LogGroupClass;
  onLogGroupClassChange?: (logGroupClass: LogGroupClass) => void;
  selectedAccountIds?: string[];
  onSelectedAccountIdsChange?: (accountIds: string[]) => void;
};

export const LogGroupsFieldWrapper = (props: WrapperProps) => {
  if (!config.featureToggles.cloudWatchCrossAccountQuerying) {
    return (
      <LegacyLogGroupSelection
        {...props}
        onChange={props.legacyOnChange}
        legacyLogGroupNames={props.legacyLogGroupNames || []}
      />
    );
  }

  return <LogGroupsField {...props} />;
};
