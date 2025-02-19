import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Alert, Badge, Icon, LinkButton, Stack, Text, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRulesSourceSymbol, Rule, RuleGroup } from 'app/types/unified-alerting';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { DynamicTable, DynamicTableColumnProps } from '../components/DynamicTable';
import { useFolder } from '../hooks/useFolder';
import { useRulesAccess } from '../utils/accessControlHooks';
import { stringifyErrorLike } from '../utils/misc';
import { groups } from '../utils/navigation';
import { getEvaluationsToStartAlerting, isAlertingRule } from '../utils/rules';
import { formatPrometheusDuration } from '../utils/time';

interface GroupDetailsProps {
  promGroup: RuleGroup;
}

function GroupDetails({ promGroup }: GroupDetailsProps) {
  const groupIntervalMs = promGroup.interval * 1000;

  return (
    <div>
      <dl>
        <dt id="group-name">Name</dt>
        <dd aria-labelledby="group-name">{promGroup.name}</dd>
        <dt id="group-interval">Interval</dt>
        <dd aria-labelledby="group-interval">{formatPrometheusDuration(groupIntervalMs)}</dd>
      </dl>
      <RulesTable rules={promGroup.rules} groupInterval={groupIntervalMs} />
    </div>
  );
}

function RulesTable({ rules, groupInterval }: { rules: Rule[]; groupInterval: number }) {
  const rows = rules.map((rule: Rule, index) => ({
    id: index,
    data: rule,
  }));

  const columns: Array<DynamicTableColumnProps<Rule>> = useMemo(() => {
    return [
      {
        id: 'alertName',
        label: 'Rule name',
        renderCell: ({ data }) => {
          return <Text truncate>{data.name}</Text>;
        },
        size: 0.4,
      },
      {
        id: 'for',
        label: 'Pending period',
        renderCell: ({ data }) => {
          if (isAlertingRule(data)) {
            return <>{formatPrometheusDuration(data.duration ? data.duration * 1000 : 0)}</>;
          }
          return null;
        },
        size: 0.3,
      },
      {
        id: 'numberEvaluations',
        label: 'Evaluation cycles to fire',
        renderCell: ({ data }) => {
          if (isAlertingRule(data)) {
            return <>{getEvaluationsToStartAlerting(data.duration ? data.duration * 1000 : 0, groupInterval)}</>;
          }
          return <Badge text="Recording" color="purple" />;
        },
        size: 0.3,
      },
    ];
  }, [groupInterval]);

  return <DynamicTable items={rows} cols={columns} />;
}

type GroupPageRouteParams = {
  sourceId?: string;
  namespaceId?: string;
  groupName?: string;
};

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { usePrometheusRuleNamespacesQuery } = alertRuleApi;

function GroupDetailsPage() {
  const { sourceId = '', namespaceId = '', groupName = '' } = useParams<GroupPageRouteParams>();

  const { folder, loading: isFolderLoading } = useFolder(sourceId === 'grafana' ? namespaceId : '');
  const { canEditRules } = useRulesAccess();

  const {
    data: dsFeatures,
    isLoading: isDsFeaturesLoading,
    error: dsFeaturesError,
  } = useDiscoverDsFeaturesQuery({ uid: sourceId === 'grafana' ? GrafanaRulesSourceSymbol : sourceId });

  const {
    data: ruleNamespaces,
    isLoading: isRuleNamespacesLoading,
    isUninitialized: isRuleNamespacesUninitialized,
    error: ruleNamespacesError,
  } = usePrometheusRuleNamespacesQuery(
    dsFeatures
      ? {
          ruleSourceName: dsFeatures?.name ?? '',
          namespace: namespaceId,
          groupName: groupName,
        }
      : skipToken
  );

  const isLoading = isFolderLoading || isDsFeaturesLoading || isRuleNamespacesLoading || isRuleNamespacesUninitialized;

  // TODO Need to improve this
  const promGroup = ruleNamespaces?.[0]?.groups.find((g) => g.name === groupName);

  const canSaveInFolder = sourceId === 'grafana' ? !!folder?.canSave : true;
  const canEdit = dsFeatures && dsFeatures.rulerConfig && canEditRules(dsFeatures.name) && canSaveInFolder;

  return (
    <AlertingPageWrapper
      pageNav={{ text: groupName }}
      title={groupName}
      subTitle={
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name="folder" />
          <div>{sourceId === 'grafana' ? folder?.title : namespaceId}</div>
        </Stack>
      }
      navId="alert-list"
      isLoading={isLoading}
      actions={
        <>
          {canEdit && (
            <LinkButton icon="pen" href={groups.editPageLink(sourceId, namespaceId, groupName)} variant="secondary">
              Edit
            </LinkButton>
          )}
        </>
      }
    >
      <>
        {dsFeaturesError && (
          <Alert title="Error loading data source details" bottomSpacing={0} topSpacing={2}>
            <div>{stringifyErrorLike(dsFeaturesError)}</div>
          </Alert>
        )}
        {ruleNamespacesError && (
          <Alert title="Error loading rule namespaces" bottomSpacing={0} topSpacing={2}>
            {stringifyErrorLike(ruleNamespacesError)}
          </Alert>
        )}
      </>
      {!isLoading && !promGroup && <EntityNotFound entity={`${namespaceId}/${groupName}`} />}
      {!isLoading && promGroup && <GroupDetails promGroup={promGroup} />}
    </AlertingPageWrapper>
  );
}

export default withErrorBoundary(GroupDetailsPage, { style: 'page' });
