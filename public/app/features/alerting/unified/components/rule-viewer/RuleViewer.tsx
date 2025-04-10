import { css } from '@emotion/css';
import { chain, isEmpty, truncate } from 'lodash';
import { useEffect, useState } from 'react';
import { useMeasure } from 'react-use';

import { NavModelItem, UrlQueryValue } from '@grafana/data';
import {
  Alert,
  LinkButton,
  LoadingBar,
  Stack,
  TabContent,
  Text,
  TextLink,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Trans, t } from 'app/core/internationalization';
import InfoPausedRule from 'app/features/alerting/unified/components/InfoPausedRule';
import { RuleActionsButtons } from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import {
  AlertInstanceTotalState,
  CombinedRule,
  RuleGroupIdentifierV2,
  RuleHealth,
  RuleIdentifier,
} from 'app/types/unified-alerting';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { logError } from '../../Analytics';
import { defaultPageNav } from '../../RuleViewer';
import { shouldUseAlertingListViewV2, shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { isError, useAsync } from '../../hooks/useAsync';
import { useRuleLocation } from '../../hooks/useCombinedRule';
import { useHasRulerV2 } from '../../hooks/useHasRuler';
import { useRuleGroupConsistencyCheck } from '../../hooks/usePrometheusConsistencyCheck';
import { useReturnTo } from '../../hooks/useReturnTo';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { Annotation } from '../../utils/constants';
import { ruleIdentifierToRuleSourceIdentifier } from '../../utils/datasource';
import { makeDashboardLink, makePanelLink, stringifyErrorLike } from '../../utils/misc';
import { createListFilterLink } from '../../utils/navigation';
import {
  RulePluginOrigin,
  getRulePluginOrigin,
  isFederatedRuleGroup,
  isPausedRule,
  prometheusRuleType,
  rulerRuleType,
} from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { WithReturnButton } from '../WithReturnButton';
import { decodeGrafanaNamespace } from '../expressions/util';
import { RedirectToCloneRule } from '../rules/CloneRule';

import { FederatedRuleWarning } from './FederatedRuleWarning';
import PausedBadge from './PausedBadge';
import { useAlertRule } from './RuleContext';
import { RecordingBadge, StateBadge } from './StateBadges';
import { AlertVersionHistory } from './tabs/AlertVersionHistory';
import { Details } from './tabs/Details';
import { History } from './tabs/History';
import { InstancesList } from './tabs/Instances';
import { QueryResults } from './tabs/Query';
import { Routing } from './tabs/Routing';

export enum ActiveTab {
  Query = 'query',
  Instances = 'instances',
  History = 'history',
  Routing = 'routing',
  Details = 'details',
  VersionHistory = 'version-history',
}

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();
const alertingListViewV2 = shouldUseAlertingListViewV2();

const shouldUseConsistencyCheck = prometheusRulesPrimary || alertingListViewV2;

const RuleViewer = () => {
  const { rule, identifier } = useAlertRule();
  const { pageNav, activeTab } = usePageNav(rule);

  // this will be used to track if we are in the process of cloning a rule
  // we want to be able to show a modal if the rule has been provisioned explain the limitations
  // of duplicating provisioned alert rules
  const [duplicateRuleIdentifier, setDuplicateRuleIdentifier] = useState<RuleIdentifier>();
  const { annotations, promRule, rulerRule } = rule;

  const hasError = isErrorHealth(promRule?.health);
  const isAlertType = prometheusRuleType.alertingRule(promRule);

  const isFederatedRule = isFederatedRuleGroup(rule.group);
  const isProvisioned = rulerRuleType.grafana.rule(rulerRule) && Boolean(rulerRule.grafana_alert.provenance);
  const isPaused = rulerRuleType.grafana.rule(rulerRule) && isPausedRule(rulerRule);

  const showError = hasError && !isPaused;
  const ruleOrigin = rulerRule ? getRulePluginOrigin(rulerRule) : getRulePluginOrigin(promRule);

  const summary = annotations[Annotation.summary];

  return (
    <AlertingPageWrapper
      pageNav={pageNav}
      navId="alert-list"
      isLoading={false}
      renderTitle={(title) => (
        <Title
          name={title}
          paused={isPaused}
          state={isAlertType ? promRule.state : undefined}
          health={promRule?.health}
          ruleType={promRule?.type}
          ruleOrigin={ruleOrigin}
        />
      )}
      actions={<RuleActionsButtons rule={rule} rulesSource={rule.namespace.rulesSource} />}
      info={createMetadata(rule)}
      subTitle={
        <Stack direction="column">
          {summary}
          {/* alerts and notifications and stuff */}
          {isPaused && <InfoPausedRule />}
          {isFederatedRule && <FederatedRuleWarning />}
          {/* indicator for rules in a provisioned group */}
          {isProvisioned && (
            <ProvisioningAlert resource={ProvisionedResource.AlertRule} bottomSpacing={0} topSpacing={2} />
          )}
          {/* error state */}
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
      <Stack direction="column" gap={2}>
        {/* tabs and tab content */}
        <TabContent>
          {activeTab === ActiveTab.Query && <QueryResults rule={rule} />}
          {activeTab === ActiveTab.Instances && <InstancesList rule={rule} />}
          {activeTab === ActiveTab.History && rulerRuleType.grafana.rule(rule.rulerRule) && (
            <History rule={rule.rulerRule} />
          )}
          {activeTab === ActiveTab.Routing && <Routing />}
          {activeTab === ActiveTab.Details && <Details rule={rule} />}
          {activeTab === ActiveTab.VersionHistory && rulerRuleType.grafana.rule(rule.rulerRule) && (
            <AlertVersionHistory rule={rule.rulerRule} />
          )}
        </TabContent>
      </Stack>
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
  const { labels, annotations, group } = rule;
  const metadata: PageInfoItem[] = [];

  const runbookUrl = annotations[Annotation.runbookURL];
  const dashboardUID = annotations[Annotation.dashboardUID];
  const panelID = annotations[Annotation.panelID];

  const hasDashboardAndPanel = dashboardUID && panelID;
  const hasDashboard = dashboardUID;
  const hasLabels = !isEmpty(labels);

  const interval = group.interval;
  const styles = useStyles2(getStyles);

  if (runbookUrl) {
    /* TODO instead of truncating the string, we should use flex and text overflow properly to allow it to take up all of the horizontal space available */
    const truncatedUrl = truncate(runbookUrl, { length: 42 });
    const valueToAdd = isValidRunbookURL(runbookUrl) ? (
      <TextLink variant="bodySmall" className={styles.url} href={runbookUrl} external>
        {truncatedUrl}
      </TextLink>
    ) : (
      <Text variant="bodySmall">{truncatedUrl}</Text>
    );
    metadata.push({
      label: 'Runbook URL',
      value: valueToAdd,
    });
  }

  if (hasDashboardAndPanel) {
    metadata.push({
      label: 'Dashboard and panel',
      value: (
        <WithReturnButton
          title={rule.name}
          component={
            <TextLink variant="bodySmall" href={makePanelLink(dashboardUID, panelID)}>
              <Trans i18nKey="alerting.create-metadata.view-panel">View panel</Trans>
            </TextLink>
          }
        />
      ),
    });
  } else if (hasDashboard) {
    metadata.push({
      label: 'Dashboard',
      value: (
        <WithReturnButton
          title={rule.name}
          component={
            <TextLink title={rule.name} variant="bodySmall" href={makeDashboardLink(dashboardUID)}>
              <Trans i18nKey="alerting.create-metadata.view-dashboard">View dashboard</Trans>
            </TextLink>
          }
        />
      ),
    });
  }
  if (rulerRuleType.grafana.recordingRule(rule.rulerRule)) {
    const metric = rule.rulerRule?.grafana_alert.record?.metric ?? '';
    metadata.push({
      label: 'Metric name',
      value: <Text color="primary">{metric}</Text>,
    });
  }

  if (interval) {
    metadata.push({
      label: 'Evaluation interval',
      value: <Text color="primary">Every {interval}</Text>,
    });
  }

  if (hasLabels) {
    metadata.push({
      label: 'Labels',
      /* TODO truncate number of labels, maybe build in to component? */
      value: <AlertLabels labels={labels} size="sm" />,
    });
  }

  return metadata;
};

interface TitleProps {
  name: string;
  paused?: boolean;
  // recording rules don't have a state
  state?: PromAlertingRuleState;
  health?: RuleHealth;
  ruleType?: PromRuleType;
  ruleOrigin?: RulePluginOrigin;
}

export const Title = ({ name, paused = false, state, health, ruleType, ruleOrigin }: TitleProps) => {
  const isRecordingRule = ruleType === PromRuleType.Recording;

  const { returnTo } = useReturnTo('/alerting/list');

  return (
    <Stack direction="row" gap={1} minWidth={0} alignItems="center">
      <LinkButton variant="secondary" icon="angle-left" href={returnTo} />
      {ruleOrigin && <PluginOriginBadge pluginId={ruleOrigin.pluginId} size="lg" />}
      <Text variant="h1" truncate>
        {name}
      </Text>
      {paused ? (
        <PausedBadge />
      ) : (
        <>
          {/* recording rules won't have a state */}
          {state && <StateBadge state={state} health={health} />}
          {isRecordingRule && <RecordingBadge health={health} />}
        </>
      )}
    </Stack>
  );
};

interface PrometheusConsistencyCheckProps {
  ruleIdentifier: RuleIdentifier;
}
/**
 * This component displays an Alert warning component if discovers inconsistencies between Prometheus and Ruler rules
 * It will show loading indicator until the Prometheus and Ruler rule is consistent
 * It will not show the warning if the rule is Grafana managed
 */
const PrometheusConsistencyCheck = withErrorBoundary(
  ({ ruleIdentifier }: PrometheusConsistencyCheckProps) => {
    const [ref, { width }] = useMeasure<HTMLDivElement>();

    const { hasRuler } = useHasRulerV2(ruleIdentifierToRuleSourceIdentifier(ruleIdentifier));
    const { result: ruleLocation } = useRuleLocation(ruleIdentifier);

    const { waitForGroupConsistency, groupConsistent } = useRuleGroupConsistencyCheck();

    const [waitAction, waitState] = useAsync((groupIdentifier: RuleGroupIdentifierV2) => {
      return waitForGroupConsistency(groupIdentifier);
    });

    useEffect(() => {
      if (ruleLocation && hasRuler) {
        waitAction.execute(ruleLocation.groupIdentifier);
      }
    }, [ruleLocation, hasRuler, waitAction]);

    if (isError(waitState)) {
      return (
        <Alert
          title={t(
            'alerting.prometheus-consistency-check.title-unable-to-check-the-rule-status',
            'Unable to check the rule status'
          )}
          bottomSpacing={0}
          topSpacing={2}
        >
          {stringifyErrorLike(waitState.error)}
        </Alert>
      );
    }

    // If groupConsistent is undefined, it means that the rule is still being checked and we don't know if it's consistent or not
    // To prevent the inconsistency banner from blinking, we only show it if groupConsistent is false
    if (groupConsistent === false) {
      return (
        <Stack direction="column" gap={0} ref={ref}>
          <LoadingBar width={width} />
          <Alert
            title={t('alerting.rule-viewer.prometheus-consistency-check.alert-title', 'Update in progress')}
            severity="info"
          >
            <Trans i18nKey="alerting.rule-viewer.prometheus-consistency-check.alert-message">
              Alert rule has been added or updated. Changes may take up to a minute to appear on the Alert rules list
              view.
            </Trans>
          </Alert>
        </Stack>
      );
    }

    return null;
  },
  { errorLogger: logError }
);

export const isErrorHealth = (health?: RuleHealth) => health === 'error' || health === 'err';

export function useActiveTab(): [ActiveTab, (tab: ActiveTab) => void] {
  const [queryParams, setQueryParams] = useQueryParams();
  const tabFromQuery = queryParams.tab;

  const activeTab = isValidTab(tabFromQuery) ? tabFromQuery : ActiveTab.Query;

  const setActiveTab = (tab: ActiveTab) => {
    setQueryParams({ tab });
  };

  return [activeTab, setActiveTab];
}

function isValidTab(tab: UrlQueryValue): tab is ActiveTab {
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

  const isGrafanaAlertRule = rulerRuleType.grafana.rule(rulerRule) && isAlertType;
  const grafanaRecordingRule = rulerRuleType.grafana.recordingRule(rulerRule);
  const isRecordingRuleType = prometheusRuleType.recordingRule(promRule);

  const pageNav: NavModelItem = {
    ...defaultPageNav,
    text: rule.name,
    subTitle: summary,
    children: [
      {
        text: 'Query and conditions',
        active: activeTab === ActiveTab.Query,
        onClick: () => {
          setActiveTab(ActiveTab.Query);
        },
      },
      {
        text: 'Instances',
        active: activeTab === ActiveTab.Instances,
        onClick: () => {
          setActiveTab(ActiveTab.Instances);
        },
        tabCounter: numberOfInstance,
        hideFromTabs: isRecordingRuleType,
      },
      {
        text: 'History',
        active: activeTab === ActiveTab.History,
        onClick: () => {
          setActiveTab(ActiveTab.History);
        },
        // alert state history is only available for Grafana managed alert rules
        hideFromTabs: !isGrafanaAlertRule,
      },
      {
        text: 'Details',
        active: activeTab === ActiveTab.Details,
        onClick: () => {
          setActiveTab(ActiveTab.Details);
        },
      },
      {
        text: 'Versions',
        active: activeTab === ActiveTab.VersionHistory,
        onClick: () => {
          setActiveTab(ActiveTab.VersionHistory);
        },
        hideFromTabs: !isGrafanaAlertRule && !grafanaRecordingRule,
      },
    ],
    parentItem: {
      text: groupName,
      url: createListFilterLink([
        ['namespace', namespaceName],
        ['group', groupName],
      ]),
      // @TODO support nested folders here
      parentItem: {
        text: namespaceName,
        url: createListFilterLink([['namespace', namespaceName]]),
      },
    },
  };

  return {
    pageNav,
    activeTab,
  };
}

export const calculateTotalInstances = (stats: CombinedRule['instanceTotals']) => {
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

const getStyles = () => ({
  title: css({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  }),
  url: css({
    wordBreak: 'break-all',
  }),
});

function isValidRunbookURL(url: string) {
  const isRelative = url.startsWith('/');
  let isAbsolute = false;

  try {
    new URL(url);
    isAbsolute = true;
  } catch (_) {
    return false;
  }

  return isRelative || isAbsolute;
}

export default RuleViewer;
