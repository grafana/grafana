import React, { useMemo, useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Alert, Button, Icon, LoadingPlaceholder, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { useRuleViewerPageTitle } from '../../../hooks/alert-details/useRuleViewerPageTitle';
import { useCombinedRule } from '../../../hooks/useCombinedRule';
import * as ruleId from '../../../utils/rule-id';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule } from '../../../utils/rules';
import { AlertStateDot } from '../../AlertStateDot';
import { ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { Spacer } from '../../Spacer';
import { History } from '../tabs/History';
import { InstancesList } from '../tabs/Instances';
import { QueryResults } from '../tabs/Query';
import { Routing } from '../tabs/Routing';

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

enum Tabs {
  Instances,
  Query,
  Routing,
  History,
}

// @TODO
// hook up tabs to query params or path segment
// figure out why we needed <AlertingPageWrapper>
// add provisioning and federation stuff back in
const RuleViewer = ({ match }: RuleViewerProps) => {
  const { id } = match.params;
  const [activeTab, setActiveTab] = useState<Tabs>(Tabs.Instances);

  const identifier = useMemo(() => {
    if (!id) {
      throw new Error('Rule ID is required');
    }

    return ruleId.parse(id, true);
  }, [id]);

  const { loading, error, result: rule } = useCombinedRule({ ruleIdentifier: identifier });

  // we're setting the document title and the breadcrumb manually
  useRuleViewerPageTitle(rule);

  if (loading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  if (error) {
    return String(error);
  }

  if (rule) {
    const summary = rule.annotations['summary'];
    const promRule = rule.promRule;

    const isAlertType = isAlertingRule(promRule);
    const numberOfInstance = isAlertType ? promRule.alerts?.length : undefined;

    const isFederatedRule = isFederatedRuleGroup(rule.group);
    const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

    return (
      <>
        <Stack direction="column" gap={3}>
          {/* breadcrumb and actions */}
          <Stack>
            <BreadCrumb folder={rule.namespace.name} evaluationGroup={rule.group.name} />
            <Spacer />
            <Stack gap={1}>
              <Button variant="secondary" icon="pen">
                Edit
              </Button>
              <Button variant="secondary">
                <Stack alignItems="center" gap={1}>
                  More <Icon name="angle-down" />
                </Stack>
              </Button>
            </Stack>
          </Stack>
          {/* header */}
          <Stack direction="column" gap={1}>
            <Stack alignItems="center">
              <Title name={rule.name} state={GrafanaAlertState.Alerting} />
            </Stack>
            {summary && <Summary text={summary} />}
          </Stack>
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
          <TabsBar>
            <Tab label="Instances" active counter={numberOfInstance} onChangeTab={() => setActiveTab(Tabs.Instances)} />
            <Tab label="Query" onChangeTab={() => setActiveTab(Tabs.Query)} />
            <Tab label="Routing" onChangeTab={() => setActiveTab(Tabs.Routing)} />
            <Tab label="History" onChangeTab={() => setActiveTab(Tabs.History)} />
          </TabsBar>
          <TabContent>
            {activeTab === Tabs.Instances && <InstancesList />}
            {activeTab === Tabs.Query && <QueryResults />}
            {activeTab === Tabs.Routing && <Routing />}
            {activeTab === Tabs.History && <History />}
          </TabContent>
        </Stack>
      </>
    );
  }

  return null;
};

interface BreadcrumbProps {
  folder: string;
  evaluationGroup: string;
}

const BreadCrumb = ({ folder, evaluationGroup }: BreadcrumbProps) => (
  <Stack alignItems="center" gap={0.5}>
    <Text color="secondary">
      <Icon name="folder" />
    </Text>
    <Text variant="body" color="primary">
      {folder}
    </Text>
    <Text variant="body" color="secondary">
      <Icon name="angle-right" />
    </Text>
    <Text variant="body" color="primary">
      {evaluationGroup}
    </Text>
  </Stack>
);

interface TitleProps {
  name: string;
  state: GrafanaAlertState;
}

const Title = ({ name, state }: TitleProps) => (
  <header>
    <Stack alignItems={'center'} gap={1}>
      <AlertStateDot size="md" state={state} />
      {/* <Button variant="secondary" fill="outline" icon="angle-left" /> */}
      <Text element="h1" variant="h2" weight="bold">
        {name}
      </Text>
      {/* <Badge color="red" text={state} icon="exclamation-circle" /> */}
    </Stack>
  </header>
);

interface SummaryProps {
  text: string;
}

const Summary = ({ text }: SummaryProps) => (
  <Text variant="body" color="secondary">
    {text}
  </Text>
);

export default RuleViewer;
