import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Alert, Badge, Button, LinkButton, Text, TextLink, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { Trans, t } from 'app/core/internationalization';
import { FolderDTO } from 'app/types';
import { GrafanaRulesSourceSymbol, RuleGroup } from 'app/types/unified-alerting';
import { PromRuleType, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { RulesSourceFeatures, featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { DynamicTable, DynamicTableColumnProps } from '../components/DynamicTable';
import { GrafanaRuleGroupExporter } from '../components/export/GrafanaRuleGroupExporter';
import { useFolder } from '../hooks/useFolder';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../rule-editor/formDefaults';
import { useRulesAccess } from '../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { makeFolderLink, stringifyErrorLike } from '../utils/misc';
import { createListFilterLink, groups } from '../utils/navigation';
import {
  calcRuleEvalsToStartAlerting,
  getRuleName,
  isFederatedRuleGroup,
  isProvisionedRuleGroup,
  rulerRuleType,
} from '../utils/rules';
import { formatPrometheusDuration, safeParsePrometheusDuration } from '../utils/time';

import { Title } from './Title';

type GroupPageRouteParams = {
  dataSourceUid?: string;
  namespaceId?: string;
  groupName?: string;
};

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { usePrometheusRuleNamespacesQuery, useGetRuleGroupForNamespaceQuery } = alertRuleApi;

function GroupDetailsPage() {
  const { dataSourceUid = '', namespaceId = '', groupName = '' } = useParams<GroupPageRouteParams>();
  const isGrafanaRuleGroup = dataSourceUid === GRAFANA_RULES_SOURCE_NAME;

  const { folder, loading: isFolderLoading } = useFolder(isGrafanaRuleGroup ? namespaceId : '');
  const {
    data: dsFeatures,
    isLoading: isDsFeaturesLoading,
    error: dsFeaturesError,
  } = useDiscoverDsFeaturesQuery({ uid: isGrafanaRuleGroup ? GrafanaRulesSourceSymbol : dataSourceUid });

  const {
    data: promGroup,
    isLoading: isRuleNamespacesLoading,
    error: ruleNamespacesError,
  } = usePrometheusRuleNamespacesQuery(
    dsFeatures && !dsFeatures.rulerConfig
      ? { ruleSourceName: dsFeatures?.name ?? '', namespace: namespaceId, groupName: groupName }
      : skipToken,
    {
      selectFromResult: (result) => ({
        ...result,
        data: result.data?.[0]?.groups.find((g) => g.name === groupName),
      }),
    }
  );

  const {
    data: rulerGroup,
    isLoading: isRuleGroupLoading,
    error: ruleGroupError,
  } = useGetRuleGroupForNamespaceQuery(
    dsFeatures?.rulerConfig
      ? { rulerConfig: dsFeatures?.rulerConfig, namespace: namespaceId, group: groupName }
      : skipToken
  );

  const isLoading = isFolderLoading || isDsFeaturesLoading || isRuleNamespacesLoading || isRuleGroupLoading;

  const groupInterval = promGroup?.interval
    ? formatPrometheusDuration(promGroup.interval * 1000)
    : (rulerGroup?.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL);

  const namespaceName = folder?.title ?? namespaceId;
  const namespaceUrl = createListFilterLink([['namespace', namespaceName]]);

  const namespaceLabel = isGrafanaRuleGroup
    ? t('alerting.group-details.folder', 'Folder')
    : t('alerting.group-details.namespace', 'Namespace');

  const namespaceValue = folder ? (
    <TextLink href={makeFolderLink(folder.uid)} inline={false}>
      {folder.title}
    </TextLink>
  ) : (
    namespaceId
  );

  return (
    <AlertingPageWrapper
      pageNav={{
        text: groupName,
        parentItem: {
          text: namespaceName,
          url: namespaceUrl,
        },
      }}
      renderTitle={(title) => <Title name={title} />}
      info={[
        { label: namespaceLabel, value: namespaceValue },
        { label: t('alerting.group-details.interval', 'Interval'), value: groupInterval },
      ]}
      navId="alert-list"
      isLoading={isLoading}
      actions={
        <>
          {dsFeatures && (
            <GroupActions
              dsFeatures={dsFeatures}
              namespaceId={namespaceId}
              groupName={groupName}
              folder={folder}
              rulerGroup={rulerGroup}
            />
          )}
        </>
      }
    >
      <>
        {Boolean(dsFeaturesError) && (
          <Alert
            title={t('alerting.group-details.ds-features-error', 'Error loading data source details')}
            bottomSpacing={0}
            topSpacing={2}
          >
            <div>{stringifyErrorLike(dsFeaturesError)}</div>
          </Alert>
        )}
        {Boolean(ruleNamespacesError || ruleGroupError) && (
          <Alert
            title={t('alerting.group-details.group-loading-error', 'Error loading the group')}
            bottomSpacing={0}
            topSpacing={2}
          >
            <div>{stringifyErrorLike(ruleNamespacesError || ruleGroupError)}</div>
          </Alert>
        )}
        {promGroup && <GroupDetails group={promRuleGroupToRuleGroupDetails(promGroup)} />}
        {rulerGroup && <GroupDetails group={rulerRuleGroupToRuleGroupDetails(rulerGroup)} />}
        {!promGroup && !rulerGroup && <EntityNotFound entity={`${namespaceId}/${groupName}`} />}
      </>
    </AlertingPageWrapper>
  );
}

interface GroupActionsProps {
  dsFeatures: RulesSourceFeatures;
  namespaceId: string;
  groupName: string;
  rulerGroup: RulerRuleGroupDTO | undefined;
  folder: FolderDTO | undefined;
}

function GroupActions({ dsFeatures, namespaceId, groupName, folder, rulerGroup }: GroupActionsProps) {
  const { canEditRules } = useRulesAccess();
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const isGrafanaSource = dsFeatures.uid === GRAFANA_RULES_SOURCE_NAME;
  const canSaveInFolder = isGrafanaSource ? Boolean(folder?.canSave) : true;

  const isFederated = rulerGroup ? isFederatedRuleGroup(rulerGroup) : false;
  const isProvisioned = rulerGroup ? isProvisionedRuleGroup(rulerGroup) : false;

  const canEdit =
    Boolean(dsFeatures.rulerConfig) &&
    canEditRules(dsFeatures.name) &&
    canSaveInFolder &&
    !isFederated &&
    !isProvisioned;

  return (
    <>
      {isGrafanaSource && (
        <Button onClick={() => setIsExporting(true)} icon="file-download" variant="secondary">
          <Trans i18nKey="alerting.group-details.export">Export</Trans>
        </Button>
      )}
      {canEdit && (
        <LinkButton
          icon="pen"
          href={groups.editPageLink(dsFeatures.uid, namespaceId, groupName, { includeReturnTo: true })}
          variant="secondary"
        >
          <Trans i18nKey="alerting.group-details.edit">Edit</Trans>
        </LinkButton>
      )}
      {folder && isExporting && (
        <GrafanaRuleGroupExporter folderUid={folder.uid} groupName={groupName} onClose={() => setIsExporting(false)} />
      )}
    </>
  );
}

/** An common interface for both Prometheus and Ruler rule groups */
interface RuleGroupDetails {
  name: string;
  interval: string;
  rules: RuleDetails[];
}

interface AlertingRuleDetails {
  name: string;
  type: 'alerting';
  pendingPeriod: string;
  evaluationsToFire: number;
}
interface RecordingRuleDetails {
  name: string;
  type: 'recording';
}

type RuleDetails = AlertingRuleDetails | RecordingRuleDetails;

interface GroupDetailsProps {
  group: RuleGroupDetails;
}

function GroupDetails({ group }: GroupDetailsProps) {
  return (
    <div>
      <RulesTable rules={group.rules} />
    </div>
  );
}

function RulesTable({ rules }: { rules: RuleDetails[] }) {
  const rows = rules.map((rule: RuleDetails, index) => ({
    id: index,
    data: rule,
  }));

  const columns: Array<DynamicTableColumnProps<RuleDetails>> = useMemo(() => {
    return [
      {
        id: 'alertName',
        label: t('alerting.group-details.rule-name', 'Rule name'),
        renderCell: ({ data }) => {
          return <Text truncate>{data.name}</Text>;
        },
        size: 0.4,
      },
      {
        id: 'for',
        label: t('alerting.group-details.pending-period', 'Pending period'),
        renderCell: ({ data }) => {
          switch (data.type) {
            case 'alerting':
              return <>{data.pendingPeriod}</>;
            case 'recording':
              return <Badge text={t('alerting.group-details.recording', 'Recording')} color="purple" />;
          }
        },
        size: 0.3,
      },
      {
        id: 'numberEvaluations',
        label: t('alerting.group-details.evaluations-to-fire', 'Evaluation cycles to fire'),
        renderCell: ({ data }) => {
          switch (data.type) {
            case 'alerting':
              return <>{data.evaluationsToFire}</>;
            case 'recording':
              return null;
          }
        },
        size: 0.3,
      },
    ];
  }, []);

  return <DynamicTable items={rows} cols={columns} />;
}

function promRuleGroupToRuleGroupDetails(group: RuleGroup): RuleGroupDetails {
  const groupIntervalMs = group.interval * 1000;

  return {
    name: group.name,
    interval: formatPrometheusDuration(group.interval * 1000),
    rules: group.rules.map<RuleDetails>((rule) => {
      switch (rule.type) {
        case PromRuleType.Alerting:
          return {
            name: rule.name,
            type: 'alerting',
            pendingPeriod: formatPrometheusDuration(rule.duration ? rule.duration * 1000 : 0),
            evaluationsToFire: calcRuleEvalsToStartAlerting(rule.duration ? rule.duration * 1000 : 0, groupIntervalMs),
          };
        case PromRuleType.Recording:
          return { name: rule.name, type: 'recording' };
      }
    }),
  };
}

function rulerRuleGroupToRuleGroupDetails(group: RulerRuleGroupDTO): RuleGroupDetails {
  const groupIntervalMs = safeParsePrometheusDuration(group.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL);

  return {
    name: group.name,
    interval: group.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL,
    rules: group.rules.map<RuleDetails>((rule) => {
      const name = getRuleName(rule);

      if (rulerRuleType.any.alertingRule(rule)) {
        return {
          name,
          type: 'alerting',
          pendingPeriod: rule.for ?? '0s',
          evaluationsToFire: calcRuleEvalsToStartAlerting(
            rule.for ? safeParsePrometheusDuration(rule.for) : 0,
            groupIntervalMs
          ),
        };
      }

      return { name, type: 'recording' };
    }),
  };
}

export default withErrorBoundary(GroupDetailsPage, { style: 'page' });
