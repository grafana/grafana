import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Alert, Badge, Button, Icon, Stack, TextLink, withErrorBoundary } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRulesSourceSymbol, RuleGroup } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { DynamicTable, DynamicTableColumnProps } from '../components/DynamicTable';
import { useFolder } from '../hooks/useFolder';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../rule-editor/formDefaults';
import { stringifyErrorLike } from '../utils/misc';
import {
  getNumberEvaluationsToStartAlerting,
  getRuleName,
  isAlertingRulerRule,
  isGrafanaRulerRule,
} from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

interface GroupDetailsProps {
  promGroup: RuleGroup;
  rulerGroup?: RulerRuleGroupDTO;
}

function GroupDetails({ promGroup, rulerGroup }: GroupDetailsProps) {
  return (
    <div>
      <AppChromeUpdate actions={<Button size="sm">Save</Button>} />
      {rulerGroup && <div>{rulerGroup.interval ?? '<Not defined>'}</div>}
      {rulerGroup && (
        <RulesTable rules={rulerGroup.rules} groupInterval={rulerGroup.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL} />
      )}
    </div>
  );
}

function RulesTable({ rules, groupInterval }: { rules: RulerRuleDTO[]; groupInterval: string }) {
  const rows = rules.map((rule: RulerRuleDTO, index) => ({
    id: index,
    data: rule,
  }));

  const columns: Array<DynamicTableColumnProps<RulerRuleDTO>> = useMemo(() => {
    return [
      {
        id: 'alertName',
        label: 'Rule name',
        renderCell: ({ data }) => {
          if (isGrafanaRulerRule(data)) {
            return (
              <TextLink href={createRelativeUrl(`/alerting/grafana/${data.grafana_alert.uid}/view`)}>
                {getRuleName(data)}
              </TextLink>
            );
          }
          return <>{getRuleName(data)}</>;
        },
        size: 0.4,
      },
      {
        id: 'for',
        label: 'Pending period',
        renderCell: ({ data }) => {
          if (isAlertingRulerRule(data) || isGrafanaRulerRule(data)) {
            return <>{data.for}</>;
          }
          return null;
        },
        size: 0.3,
      },
      {
        id: 'numberEvaluations',
        label: 'Evaluation cycles to fire',
        renderCell: ({ data }) => {
          if (isAlertingRulerRule(data) || isGrafanaRulerRule(data)) {
            return <>{getNumberEvaluationsToStartAlerting(data.for ?? '0s', groupInterval)}</>;
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
const { useGetRuleGroupForNamespaceQuery, usePrometheusRuleNamespacesQuery } = alertRuleApi;

function GroupDetailsPage() {
  const { sourceId = '', namespaceId = '', groupName = '' } = useParams<GroupPageRouteParams>();

  const { folder, loading: isFolderLoading } = useFolder(sourceId === 'grafana' ? namespaceId : '');

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
    {
      ruleSourceName: dsFeatures?.name ?? '',
      namespace: namespaceId,
      groupName: groupName,
    },
    { skip: !dsFeatures }
  );

  const {
    data: rulerGroup,
    isLoading: isRuleGroupLoading,
    isUninitialized: isRuleGroupUninitialized,
    error: ruleGroupError,
  } = useGetRuleGroupForNamespaceQuery(
    {
      rulerConfig: dsFeatures?.rulerConfig!,
      namespace: namespaceId,
      group: groupName,
    },
    { skip: !dsFeatures?.rulerConfig }
  );

  const isLoading =
    isFolderLoading ||
    isDsFeaturesLoading ||
    isRuleNamespacesLoading ||
    isRuleNamespacesUninitialized ||
    isRuleGroupLoading ||
    isRuleGroupUninitialized;

  // TODO Need to improve this
  const promGroup = ruleNamespaces?.[0]?.groups.find((g) => g.name === groupName);

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
        {ruleGroupError && (
          <Alert title="Error loading rule group" bottomSpacing={0} topSpacing={2}>
            {stringifyErrorLike(ruleGroupError)}
          </Alert>
        )}
      </>
      {!isLoading && !promGroup && <EntityNotFound entity={`${namespaceId}/${groupName}`} />}
      {!isLoading && promGroup && <GroupDetails promGroup={promGroup} rulerGroup={rulerGroup} />}
    </AlertingPageWrapper>
  );
}

export default withErrorBoundary(GroupDetailsPage, { style: 'page' });
