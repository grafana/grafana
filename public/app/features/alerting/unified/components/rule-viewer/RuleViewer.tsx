import { css } from '@emotion/css';
import { isEmpty, truncate } from 'lodash';
import React, { useState } from 'react';

import { NavModelItem, UrlQueryValue } from '@grafana/data';
import { Alert, LinkButton, Stack, TabContent, Text, TextLink, useStyles2 } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { CombinedRule, RuleHealth, RuleIdentifier } from 'app/types/unified-alerting';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { defaultPageNav } from '../../RuleViewer';
import { Annotation } from '../../utils/constants';
import { makeDashboardLink, makePanelLink } from '../../utils/misc';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule, isRecordingRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';
import { AlertLabels } from '../AlertLabels';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { WithReturnButton } from '../WithReturnButton';
import { decodeGrafanaNamespace } from '../expressions/util';
import { RedirectToCloneRule } from '../rules/CloneRule';

import { useAlertRulePageActions } from './Actions';
import { useDeleteModal } from './DeleteModal';
import { FederatedRuleWarning } from './FederatedRuleWarning';
import { useAlertRule } from './RuleContext';
import { RecordingBadge, StateBadge } from './StateBadges';
import { Details } from './tabs/Details';
import { History } from './tabs/History';
import { InstancesList } from './tabs/Instances';
import { QueryResults } from './tabs/Query';
import { Routing } from './tabs/Routing';

enum ActiveTab {
  Query = 'query',
  Instances = 'instances',
  History = 'history',
  Routing = 'routing',
  Details = 'details',
}

const RuleViewer = () => {
  const { rule } = useAlertRule();
  const { pageNav, activeTab } = usePageNav(rule);

  // this will be used to track if we are in the process of cloning a rule
  // we want to be able to show a modal if the rule has been provisioned explain the limitations
  // of duplicating provisioned alert rules
  const [duplicateRuleIdentifier, setDuplicateRuleIdentifier] = useState<RuleIdentifier>();

  const [deleteModal, showDeleteModal] = useDeleteModal();
  const actions = useAlertRulePageActions({
    handleDuplicateRule: setDuplicateRuleIdentifier,
    handleDelete: showDeleteModal,
  });

  const { annotations, promRule } = rule;
  const hasError = isErrorHealth(rule.promRule?.health);

  const isAlertType = isAlertingRule(promRule);

  const isFederatedRule = isFederatedRuleGroup(rule.group);
  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  const summary = annotations[Annotation.summary];

  return (
    <AlertingPageWrapper
      pageNav={pageNav}
      navId="alert-list"
      isLoading={false}
      renderTitle={(title) => (
        <Title
          name={title}
          state={isAlertType ? promRule.state : undefined}
          health={rule.promRule?.health}
          ruleType={rule.promRule?.type}
        />
      )}
      actions={actions}
      info={createMetadata(rule)}
      subTitle={
        <Stack direction="column">
          {summary}
          {/* alerts and notifications and stuff */}
          {isFederatedRule && <FederatedRuleWarning />}
          {/* indicator for rules in a provisioned group */}
          {isProvisioned && (
            <ProvisioningAlert resource={ProvisionedResource.AlertRule} bottomSpacing={0} topSpacing={2} />
          )}
          {/* error state */}
          {hasError && (
            <Alert title="Something went wrong when evaluating this alert rule" bottomSpacing={0} topSpacing={2}>
              <pre style={{ marginBottom: 0 }}>
                <code>{rule.promRule?.lastError ?? 'No error message'}</code>
              </pre>
            </Alert>
          )}
        </Stack>
      }
    >
      <Stack direction="column" gap={2}>
        {/* tabs and tab content */}
        <TabContent>
          {activeTab === ActiveTab.Query && <QueryResults rule={rule} />}
          {activeTab === ActiveTab.Instances && <InstancesList rule={rule} />}
          {activeTab === ActiveTab.History && isGrafanaRulerRule(rule.rulerRule) && <History rule={rule.rulerRule} />}
          {activeTab === ActiveTab.Routing && <Routing />}
          {activeTab === ActiveTab.Details && <Details rule={rule} />}
        </TabContent>
      </Stack>

      {deleteModal}
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

  if (runbookUrl) {
    metadata.push({
      label: 'Runbook',
      value: (
        <TextLink variant="bodySmall" href={runbookUrl} external>
          {/* TODO instead of truncating the string, we should use flex and text overflow properly to allow it to take up all of the horizontal space available */}
          {truncate(runbookUrl, { length: 42 })}
        </TextLink>
      ),
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
              View panel
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
              View dashboard
            </TextLink>
          }
        />
      ),
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

// TODO move somewhere else
export const createListFilterLink = (values: Array<[string, string]>) => {
  const params = new URLSearchParams([['search', values.map(([key, value]) => `${key}:"${value}"`).join(' ')]]);
  return createUrl(`/alerting/list?` + params.toString());
};

interface TitleProps {
  name: string;
  // recording rules don't have a state
  state?: PromAlertingRuleState;
  health?: RuleHealth;
  ruleType?: PromRuleType;
}

export const Title = ({ name, state, health, ruleType }: TitleProps) => {
  const styles = useStyles2(getStyles);
  const isRecordingRule = ruleType === PromRuleType.Recording;

  return (
    <div className={styles.title}>
      <LinkButton variant="secondary" icon="angle-left" href="/alerting/list" />
      <Text variant="h1" truncate>
        {name}
      </Text>
      {/* recording rules won't have a state */}
      {state && <StateBadge state={state} health={health} />}
      {isRecordingRule && <RecordingBadge health={health} />}
    </div>
  );
};

export const isErrorHealth = (health?: RuleHealth) => health === 'error' || health === 'err';

function useActiveTab(): [ActiveTab, (tab: ActiveTab) => void] {
  const [queryParams, setQueryParams] = useQueryParams();
  const tabFromQuery = queryParams['tab'];

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

  const { annotations, promRule } = rule;

  const summary = annotations[Annotation.summary];
  const isAlertType = isAlertingRule(promRule);
  const numberOfInstance = isAlertType ? (promRule.alerts ?? []).length : undefined;

  const namespaceName = decodeGrafanaNamespace(rule.namespace).name;
  const groupName = rule.group.name;

  const isGrafanaAlertRule = isGrafanaRulerRule(rule.rulerRule) && isAlertType;
  const isRecordingRuleType = isRecordingRule(rule.promRule);

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

const getStyles = () => ({
  title: css({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  }),
});

export default RuleViewer;
