import { css } from '@emotion/css';
import { chain } from 'lodash';
import { useState } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';
import InfoPausedRule from 'app/features/alerting/unified/components/InfoPausedRule';
import { RuleActionsButtons } from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import { AlertInstanceTotalState, AlertInstanceTotals, CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';

import { defaultPageNav } from '../../RuleViewer';
import { useRuleViewExtensionsNav } from '../../enterprise-components/rule-view-page/navigation';
import { shouldUseAlertingListViewV2, shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { useReturnTo } from '../../hooks/useReturnTo';
import { getAlertRulesNavId } from '../../navigation/useAlertRulesNav';
import { Annotation } from '../../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceUid, isGrafanaRulesSource } from '../../utils/datasource';
import { labelsSize } from '../../utils/labels';
import { createListFilterLink, groups } from '../../utils/navigation';
import {
  getRulePluginOrigin,
  isFederatedRuleGroup,
  isGrafanaRuleIdentifier,
  isPausedRule,
  prometheusRuleType,
  rulerRuleType,
} from '../../utils/rules';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { InhibitionRulesAlert } from '../InhibitionRulesAlert';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { decodeGrafanaNamespace } from '../expressions/util';
import { RedirectToCloneRule } from '../rules/CloneRule';

import { Details } from './Details.v2';
import { FederatedRuleWarning } from './FederatedRuleWarning';
import { useAlertRule } from './RuleContext';
import { ActiveTab, PrometheusConsistencyCheck, Title, isErrorHealth, useActiveTab } from './RuleViewer';
import { AlertVersionHistory } from './tabs/AlertVersionHistory';
import { History } from './tabs/History';
import { InstancesList } from './tabs/Instances';
import { Notifications } from './tabs/Notifications';
import { QueryResults } from './tabs/Query';
import { Routing } from './tabs/Routing';
import { RulePageEnrichmentSectionExtension } from './tabs/extensions/RuleViewerExtension';

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();
const alertingListViewV2 = shouldUseAlertingListViewV2();

const RuleViewer = () => {
  const { rule, identifier } = useAlertRule();
  const { pageNav, tabs, activeTab } = usePageNav(rule);
  const styles = useStyles2(getStyles);

  const shouldUseConsistencyCheck = isGrafanaRuleIdentifier(identifier)
    ? false
    : prometheusRulesPrimary || alertingListViewV2;

  const [duplicateRuleIdentifier, setDuplicateRuleIdentifier] = useState<RuleIdentifier>();
  const { returnTo } = useReturnTo('/alerting/list');
  const { annotations, promRule, rulerRule, namespace } = rule;

  const hasError = isErrorHealth(promRule?.health);

  const isFederatedRule = isFederatedRuleGroup(rule.group);
  const isProvisioned = rulerRuleType.grafana.rule(rulerRule) && Boolean(rulerRule.grafana_alert.provenance);
  const isPaused = rulerRuleType.grafana.rule(rulerRule) && isPausedRule(rulerRule);

  const showError = hasError && !isPaused;
  const ruleOrigin = rulerRule ? getRulePluginOrigin(rulerRule) : getRulePluginOrigin(promRule);

  const summary = annotations[Annotation.summary];

  return (
    <AlertingPageWrapper
      pageNav={pageNav}
      navId={getAlertRulesNavId()}
      isLoading={false}
      renderTitle={(title) => (
        <Title
          name={title}
          paused={isPaused}
          state={prometheusRuleType.alertingRule(promRule) ? promRule.state : undefined}
          health={promRule?.health}
          ruleType={promRule?.type}
          ruleOrigin={ruleOrigin}
          returnToHref={returnTo}
        />
      )}
      actions={<RuleActionsButtons rule={rule} rulesSource={rule.namespace.rulesSource} />}
      info={createMetadata(rule)}
      subTitle={
        <Stack direction="column">
          {summary}
          {isPaused && <InfoPausedRule />}
          {isFederatedRule && <FederatedRuleWarning />}
          {isProvisioned && (
            <ProvisioningAlert resource={ProvisionedResource.AlertRule} bottomSpacing={0} topSpacing={2} />
          )}
          {showError && (
            <Alert
              title={t(
                'alerting.rule-viewer.title-something-wrong-evaluating-alert',
                'Something went wrong when evaluating this alert rule'
              )}
              bottomSpacing={0}
              topSpacing={2}
            >
              <pre style={{ marginBottom: 0 }}>
                <code>{rule.promRule?.lastError ?? 'No error message'}</code>
              </pre>
            </Alert>
          )}
        </Stack>
      }
    >
      {shouldUseConsistencyCheck && <PrometheusConsistencyCheck ruleIdentifier={identifier} />}
      {isGrafanaRulesSource(namespace.rulesSource) && (
        <InhibitionRulesAlert alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME} />
      )}
      <div className={styles.layout}>
        <Stack direction="column" gap={0}>
          {/* local tab bar — rendered inside the grid so sidebar sits alongside it */}
          <div className={styles.tabsWrapper}>
            <TabsBar>
              {tabs.map((tab, index) =>
                !tab.hideFromTabs ? (
                  <Tab
                    key={`${tab.text}-${index}`}
                    label={tab.text}
                    active={tab.active}
                    counter={tab.tabCounter}
                    suffix={tab.tabSuffix}
                    onChangeTab={tab.onClick}
                  />
                ) : null
              )}
            </TabsBar>
          </div>
          <TabContent>
            {activeTab === ActiveTab.Query && <QueryResults rule={rule} />}
            {activeTab === ActiveTab.Instances && <InstancesList rule={rule} />}
            {activeTab === ActiveTab.History && rulerRuleType.grafana.rule(rule.rulerRule) && (
              <History rule={rule.rulerRule} />
            )}
            {activeTab === ActiveTab.Notifications && rulerRuleType.grafana.rule(rule.rulerRule) && (
              <Notifications rule={rule.rulerRule} />
            )}
            {activeTab === ActiveTab.Routing && <Routing />}
            {activeTab === ActiveTab.VersionHistory && rulerRuleType.grafana.rule(rule.rulerRule) && (
              <AlertVersionHistory rule={rule.rulerRule} />
            )}
            {activeTab === ActiveTab.Enrichment && rule.uid && (
              <RulePageEnrichmentSectionExtension ruleUid={rule.uid} />
            )}
          </TabContent>
        </Stack>
        <aside className={styles.sidebar}>
          <Details rule={rule} />
        </aside>
      </div>
      {duplicateRuleIdentifier && (
        <RedirectToCloneRule
          redirectTo={true}
          identifier={duplicateRuleIdentifier}
          isProvisioned={isProvisioned}
          onDismiss={() => setDuplicateRuleIdentifier(undefined)}
        />
      )}
    </AlertingPageWrapper>
  );
};

const createMetadata = (rule: CombinedRule): PageInfoItem[] => {
  const { labels } = rule;
  const metadata: PageInfoItem[] = [];

  const hasLabels = labelsSize(labels) > 0;

  if (hasLabels) {
    metadata.push({
      label: t('alerting.create-metadata.label.labels', 'Labels'),
      value: <AlertLabels labels={labels} size="sm" />,
    });
  }

  return metadata;
};

function isValidTab(tab: unknown): tab is ActiveTab {
  const isString = typeof tab === 'string';
  // @ts-ignore
  return isString && Object.values(ActiveTab).includes(tab);
}

function usePageNav(rule: CombinedRule) {
  const [activeTab, setActiveTab] = useActiveTab();

  const { annotations, promRule, rulerRule } = rule;

  const summary = annotations[Annotation.summary];
  const isAlertType = prometheusRuleType.alertingRule(promRule);
  const numberOfInstance = isAlertType ? calculateTotalInstances(rule.instanceTotals) : undefined;

  const namespaceName = decodeGrafanaNamespace(rule.namespace).name;
  const groupName = rule.group.name;

  const isGrafanaAlertRule = rulerRuleType.grafana.alertingRule(rulerRule);
  const isGrafanaRecordingRule = rulerRuleType.grafana.recordingRule(rulerRule);
  const isRecordingRuleType = prometheusRuleType.recordingRule(promRule);

  const dataSourceUID = getRulesSourceUid(rule.namespace.rulesSource);
  const namespaceString = getNamespaceString(rule);

  const groupDetailsUrl = groups.detailsPageLink(dataSourceUID, namespaceString, groupName);

  const setActiveTabFromString = (tab: string) => {
    if (isValidTab(tab)) {
      setActiveTab(tab);
    }
  };

  const tabs: NavModelItem[] = [
    {
      text: t('alerting.use-page-nav.page-nav.text.query-and-conditions', 'Query and conditions'),
      active: activeTab === ActiveTab.Query,
      onClick: () => {
        setActiveTab(ActiveTab.Query);
      },
    },
    {
      text: t('alerting.use-page-nav.page-nav.text.instances', 'Instances'),
      active: activeTab === ActiveTab.Instances,
      onClick: () => {
        setActiveTab(ActiveTab.Instances);
      },
      tabCounter: numberOfInstance,
      hideFromTabs: isRecordingRuleType,
    },
    {
      text: t('alerting.use-page-nav.page-nav.text.history', 'History'),
      active: activeTab === ActiveTab.History,
      onClick: () => {
        setActiveTab(ActiveTab.History);
      },
      hideFromTabs: !isGrafanaAlertRule,
    },
    {
      text: t('alerting.use-page-nav.page-nav.text.notifications', 'Notifications'),
      active: activeTab === ActiveTab.Notifications,
      onClick: () => {
        setActiveTab(ActiveTab.Notifications);
      },
      hideFromTabs: !isGrafanaAlertRule || !config.featureToggles.alertingNotificationHistoryRuleViewer,
    },
    ...useRuleViewExtensionsNav(activeTab, setActiveTabFromString),
    {
      text: t('alerting.use-page-nav.page-nav.text.versions', 'Versions'),
      active: activeTab === ActiveTab.VersionHistory,
      onClick: () => {
        setActiveTab(ActiveTab.VersionHistory);
      },
      hideFromTabs: !isGrafanaAlertRule && !isGrafanaRecordingRule,
    },
  ];

  const pageNav: NavModelItem = {
    ...defaultPageNav,
    text: rule.name,
    subTitle: summary,
    parentItem: {
      text: groupName,
      url: groupDetailsUrl,
      parentItem: {
        text: namespaceName,
        url: createListFilterLink([['namespace', namespaceName]]),
      },
    },
  };

  return {
    pageNav,
    tabs,
    activeTab,
  };
}

const calculateTotalInstances = (stats: AlertInstanceTotals) => {
  return chain(stats)
    .pick([
      AlertInstanceTotalState.Alerting,
      AlertInstanceTotalState.Pending,
      AlertInstanceTotalState.Recovering,
      AlertInstanceTotalState.Normal,
      AlertInstanceTotalState.NoData,
      AlertInstanceTotalState.Error,
    ])
    .values()
    .sum()
    .value();
};

const getStyles = (theme: GrafanaTheme2) => ({
  tabsWrapper: css({
    paddingBottom: theme.spacing(3),
  }),
  layout: css({
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: theme.spacing(3),
    alignItems: 'start',

    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  sidebar: css({
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    paddingLeft: theme.spacing(3),

    [theme.breakpoints.down('lg')]: {
      borderLeft: 'none',
      paddingLeft: 0,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      paddingTop: theme.spacing(3),
    },
  }),
});

function getNamespaceString(rule: CombinedRule): string {
  if (rule.namespace.uid) {
    return rule.namespace.uid;
  }

  const isDataSourceManagedRulerRule = rulerRuleType.dataSource.rule(rule.rulerRule);
  const isDataSourceManagedPromRule =
    prometheusRuleType.rule(rule.promRule) && !prometheusRuleType.grafana.rule(rule.promRule);

  if (isDataSourceManagedRulerRule || isDataSourceManagedPromRule) {
    return rule.namespace.name;
  }

  if (rulerRuleType.grafana.rule(rule.rulerRule)) {
    return rule.rulerRule?.grafana_alert.namespace_uid;
  }

  if (prometheusRuleType.grafana.rule(rule.promRule)) {
    return rule.promRule.folderUid;
  }

  return rule.namespace.name;
}

export default RuleViewer;
