import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Dropdown, Icon, LinkButton, Menu, TextLink, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { FolderDTO } from 'app/types/folders';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { RulesSourceFeatures, featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { GrafanaRuleGroupExporter } from '../components/export/GrafanaRuleGroupExporter';
import { useFolder } from '../hooks/useFolder';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../rule-editor/formDefaults';
import { DataSourceGroupLoader } from '../rule-list/DataSourceGroupLoader';
import { GrafanaGroupLoader } from '../rule-list/GrafanaGroupLoader';
import { useRulesAccess } from '../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME, getDataSourceByUid } from '../utils/datasource';
import { makeFolderLink, stringifyErrorLike } from '../utils/misc';
import { createListFilterLink, groups } from '../utils/navigation';
import { isFederatedRuleGroup, isProvisionedRuleGroup } from '../utils/rules';
import { formatPrometheusDuration } from '../utils/time';

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

  const ruleSourceName = isGrafanaRuleGroup ? GRAFANA_RULES_SOURCE_NAME : getDataSourceByUid(dataSourceUid)?.name;
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
      subTitle={t('alerting.titles.group-view.subtitle', 'Manage alert rules, recording rules and evaluation interval')}
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
        {!promGroup && !rulerGroup && <EntityNotFound entity={`${namespaceId}/${groupName}`} />}

        {ruleSourceName && (
          <ul role="tree">
            {isGrafanaRuleGroup ? (
              <GrafanaGroupLoader
                groupIdentifier={{ groupName, groupOrigin: 'grafana', namespace: { uid: namespaceId } }}
                namespaceName={namespaceName}
              />
            ) : (
              <DataSourceGroupLoader
                groupIdentifier={{
                  groupName,
                  groupOrigin: 'datasource',
                  namespace: {
                    name: namespaceName,
                  },
                  rulesSource: {
                    name: ruleSourceName,
                    uid: dataSourceUid,
                    ruleSourceType: 'datasource',
                  },
                }}
              />
            )}
          </ul>
        )}
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
        <>
          <LinkButton
            icon="pen"
            href={groups.editPageLink(dsFeatures.uid, namespaceId, groupName, { includeReturnTo: true })}
            variant="secondary"
          >
            <Trans i18nKey="alerting.group-details.edit">Edit</Trans>
          </LinkButton>
          {/* Data source managed requires different URLs, a hassle to implement for now */}
          {isGrafanaSource && (
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item
                    icon="bell"
                    url={groups.newAlertRuleLink(folder?.title, folder?.uid, groupName)}
                    label={t('alerting.alert-rule.term', 'Alert rule')}
                  />
                  <Menu.Item
                    icon="record-audio"
                    url={groups.newRecordingRuleLink(folder?.title, folder?.uid, groupName)}
                    label={t('alerting.recording-rule.term', 'Recording rule')}
                  />
                </Menu>
              }
            >
              <Button variant="primary">
                {t('alerting.group-details.new', 'New')}
                <Icon name="angle-down" />
              </Button>
            </Dropdown>
          )}
        </>
      )}
      {folder && isExporting && (
        <GrafanaRuleGroupExporter folderUid={folder.uid} groupName={groupName} onClose={() => setIsExporting(false)} />
      )}
    </>
  );
}

export default withErrorBoundary(GroupDetailsPage, { style: 'page' });
