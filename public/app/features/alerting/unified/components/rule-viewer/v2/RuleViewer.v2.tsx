import { isEmpty, truncate } from 'lodash';
import React, { useState } from 'react';

import { NavModelItem, UrlQueryValue } from '@grafana/data';
import { Alert, Button, LinkButton, Stack, TabContent, Text, TextLink } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { defaultPageNav } from '../../../RuleViewer';
import { Annotation } from '../../../utils/constants';
import { makeDashboardLink, makePanelLink } from '../../../utils/misc';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule } from '../../../utils/rules';
import { createUrl } from '../../../utils/url';
import { AlertLabels } from '../../AlertLabels';
import { AlertStateDot } from '../../AlertStateDot';
import { AlertingPageWrapper } from '../../AlertingPageWrapper';
import { ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { decodeGrafanaNamespace } from '../../expressions/util';
import { RedirectToCloneRule } from '../../rules/CloneRule';
import { Details } from '../tabs/Details';
import { History } from '../tabs/History';
import { InstancesList } from '../tabs/Instances';
import { QueryResults } from '../tabs/Query';
import { Routing } from '../tabs/Routing';

import { useAlertRulePageActions } from './Actions';
import { useDeleteModal } from './DeleteModal';
import { useAlertRule } from './RuleContext';

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

  const promRule = rule.promRule;

  const isAlertType = isAlertingRule(promRule);

  const isFederatedRule = isFederatedRuleGroup(rule.group);
  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  return (
    <AlertingPageWrapper
      pageNav={pageNav}
      navId="alert-list"
      isLoading={false}
      renderTitle={(title) => {
        return <Title name={title} state={isAlertType ? promRule.state : undefined} />;
      }}
      actions={actions}
      info={createMetadata(rule)}
    >
      <Stack direction="column" gap={2}>
        {/* actions */}
        <Stack direction="column" gap={2}>
          {/* alerts and notifications and stuff */}
          {isFederatedRule && (
            <Alert severity="info" title="This rule is part of a federated rule group.">
              <Stack direction="column">
                Federated rule groups are currently an experimental feature.
                <Button fill="text" icon="book">
                  <a href="https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation">
                    Read documentation
                  </a>
                </Button>
              </Stack>
            </Alert>
          )}
          {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.AlertRule} />}
          {/* tabs and tab content */}
          <TabContent>
            {activeTab === ActiveTab.Query && <QueryResults rule={rule} />}
            {activeTab === ActiveTab.Instances && <InstancesList rule={rule} />}
            {activeTab === ActiveTab.History && isGrafanaRulerRule(rule.rulerRule) && <History rule={rule.rulerRule} />}
            {activeTab === ActiveTab.Routing && <Routing />}
            {activeTab === ActiveTab.Details && <Details rule={rule} />}
          </TabContent>
        </Stack>
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

  const hasPanel = dashboardUID && panelID;
  const hasDashboardWithoutPanel = dashboardUID && !panelID;
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

  if (hasPanel) {
    metadata.push({
      label: 'Dashboard and panel',
      value: (
        <TextLink variant="bodySmall" href={makePanelLink(dashboardUID, panelID)} external>
          View panel
        </TextLink>
      ),
    });
  } else if (hasDashboardWithoutPanel) {
    metadata.push({
      label: 'Dashboard',
      value: (
        <TextLink variant="bodySmall" href={makeDashboardLink(dashboardUID)} external>
          View dashboard
        </TextLink>
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
}

export const Title = ({ name, state }: TitleProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
    <LinkButton variant="secondary" icon="angle-left" href="/alerting/list" />
    <Text element="h1" truncate>
      {name}
    </Text>
    {/* recording rules won't have a state */}
    {state && <StateBadge state={state} />}
  </div>
);

interface StateBadgeProps {
  state: PromAlertingRuleState;
}

// TODO move to separate component
const StateBadge = ({ state }: StateBadgeProps) => {
  let stateLabel: string;
  let textColor: 'success' | 'error' | 'warning';

  switch (state) {
    case PromAlertingRuleState.Inactive:
      textColor = 'success';
      stateLabel = 'Normal';
      break;
    case PromAlertingRuleState.Firing:
      textColor = 'error';
      stateLabel = 'Firing';
      break;
    case PromAlertingRuleState.Pending:
      textColor = 'warning';
      stateLabel = 'Pending';
      break;
  }

  return (
    <Stack direction="row" gap={0.5}>
      <AlertStateDot size="md" state={state} />
      <Text variant="bodySmall" color={textColor}>
        {stateLabel}
      </Text>
    </Stack>
  );
};

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

  const namespaceName = decodeGrafanaNamespace(rule.namespace);
  const groupName = rule.group.name;

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
      },
      {
        text: 'History',
        active: activeTab === ActiveTab.History,
        onClick: () => {
          setActiveTab(ActiveTab.History);
        },
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

export default RuleViewer;
