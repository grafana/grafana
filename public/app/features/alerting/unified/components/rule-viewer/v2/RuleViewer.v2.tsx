import { isEmpty, truncate } from 'lodash';
import React, { useMemo, useState } from 'react';

import { Stack } from '@grafana/experimental';
import {
  Alert,
  Button,
  Dropdown,
  Icon,
  LinkButton,
  LoadingPlaceholder,
  Menu,
  Tab,
  TabContent,
  TabsBar,
  Text,
} from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { Annotations, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { useRuleViewerPageTitle } from '../../../hooks/alert-details/useRuleViewerPageTitle';
import { useCombinedRule } from '../../../hooks/useCombinedRule';
import { Annotation } from '../../../utils/constants';
import {
  createShareLink,
  isLocalDevEnv,
  isOpenSourceEdition,
  makeDashboardLink,
  makePanelLink,
} from '../../../utils/misc';
import * as ruleId from '../../../utils/rule-id';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule } from '../../../utils/rules';
import { AlertLabels } from '../../AlertLabels';
import { AlertStateDot } from '../../AlertStateDot';
import { Link } from '../../ExternalLink';
import { MetaText } from '../../MetaText';
import MoreButton from '../../MoreButton';
import { ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { Spacer } from '../../Spacer';
import { DeclareIncidentMenuItem } from '../../bridges/DeclareIncidentButton';
import { Details } from '../tabs/Details';
import { History } from '../tabs/History';
import { InstancesList } from '../tabs/Instances';
import { QueryResults } from '../tabs/Query';
import { Routing } from '../tabs/Routing';

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

enum Tabs {
  Query,
  Instances,
  History,
  Routing,
  Details,
}

// @TODO
// hook up tabs to query params or path segment
// figure out why we needed <AlertingPageWrapper>
// add provisioning and federation stuff back in
const RuleViewer = ({ match }: RuleViewerProps) => {
  const [activeTab, setActiveTab] = useState<Tabs>(Tabs.Query);

  const id = ruleId.getRuleIdFromPathname(match.params);
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
    // should fit in a tweet
    const summary = rule.annotations[Annotation.summary];
    const promRule = rule.promRule;

    const isAlertType = isAlertingRule(promRule);
    const numberOfInstance = isAlertType ? promRule.alerts?.length : undefined;

    const isFederatedRule = isFederatedRuleGroup(rule.group);
    const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

    /**
     * Since Incident isn't available as an open-source product we shouldn't show it for Open-Source licenced editions of Grafana.
     * We should show it in development mode
     */
    const shouldShowDeclareIncidentButton = !isOpenSourceEdition() || isLocalDevEnv();
    const buildShareUrl = () => createShareLink(rule.namespace.rulesSource, rule);

    return (
      <>
        <Stack direction="column" gap={1} wrap={false}>
          {/* breadcrumb and actions */}
          <BreadCrumb folder={rule.namespace.name} evaluationGroup={rule.group.name} />

          <Stack direction="column" gap={2} wrap={false}>
            {/* header */}
            <Stack direction="column" gap={1}>
              <Stack direction="row" alignItems="center">
                {/* // TODO normalize states from prom to grafana and pass to title */}
                <Title name={rule.name} state={isAlertType ? promRule.state : undefined} />
                <Spacer />
                <Stack gap={1}>
                  <Button variant="secondary" icon="pen">
                    Edit
                  </Button>
                  <Dropdown
                    overlay={
                      <Menu>
                        {/* TODO add "declare incident" */}
                        <Menu.Item label="Silence" icon="bell-slash" />
                        {shouldShowDeclareIncidentButton && (
                          <DeclareIncidentMenuItem title={rule.name} url={buildShareUrl()} />
                        )}
                        <Menu.Item label="Duplicate" icon="copy" />
                        <Menu.Divider />
                        <Menu.Item label="Copy link" icon="clipboard-alt" />
                        <Menu.Item
                          label="Export"
                          icon="download-alt"
                          childItems={[
                            <Menu.Item key="no-modifications" label="Without modifications" icon="file-blank" />,
                            <Menu.Item key="with-modifications" label="With modifications" icon="file-alt" />,
                          ]}
                        />
                        <Menu.Divider />
                        <Menu.Item label="Delete" icon="trash-alt" destructive />
                      </Menu>
                    }
                  >
                    <MoreButton size="md" />
                  </Dropdown>
                </Stack>
              </Stack>
              {summary && <Summary text={summary} />}
            </Stack>

            <Metadata labels={rule.labels} annotations={rule.annotations} interval={rule.group.interval} />

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
              <Tab
                label="Query and conditions"
                onChangeTab={() => setActiveTab(Tabs.Query)}
                active={activeTab === Tabs.Query}
              />
              <Tab
                label="Instances"
                counter={numberOfInstance}
                onChangeTab={() => setActiveTab(Tabs.Instances)}
                active={activeTab === Tabs.Instances}
              />
              <Tab label="History" onChangeTab={() => setActiveTab(Tabs.History)} active={activeTab === Tabs.History} />
              <Tab label="Routing" onChangeTab={() => setActiveTab(Tabs.Routing)} active={activeTab === Tabs.Routing} />
              <Tab label="Details" onChangeTab={() => setActiveTab(Tabs.Details)} active={activeTab === Tabs.Details} />
            </TabsBar>
            <TabContent>
              {activeTab === Tabs.Query && <QueryResults rule={rule} />}
              {activeTab === Tabs.Instances && <InstancesList rule={rule} />}
              {activeTab === Tabs.History && <History />}
              {activeTab === Tabs.Routing && <Routing />}
              {activeTab === Tabs.Details && <Details />}
            </TabContent>
          </Stack>
        </Stack>
      </>
    );
  }

  return null;
};

interface MetadataProps {
  labels: Record<string, string>;
  annotations: Annotations;
  interval?: string;
}

const Metadata = ({ labels, annotations, interval }: MetadataProps) => {
  const runbookUrl = annotations[Annotation.runbookURL];
  const dashboardUID = annotations[Annotation.dashboardUID];
  const panelID = annotations[Annotation.panelID];

  const hasPanel = dashboardUID && panelID;
  const hasDashboardNoPanel = dashboardUID && !panelID;

  return (
    <>
      <Stack direction="row">
        {runbookUrl && (
          <MetaText direction="column">
            Runbook
            <Link href={runbookUrl} size="sm" external>
              {truncate(runbookUrl, { length: 42 })}
            </Link>
          </MetaText>
        )}

        {hasPanel && (
          <MetaText direction="column">
            Dashboard and panel
            <Link href={makePanelLink(dashboardUID, panelID)} size="sm" external>
              View panel
            </Link>
          </MetaText>
        )}

        {hasDashboardNoPanel && (
          <MetaText direction="column">
            Dashboard
            <Link href={makeDashboardLink(dashboardUID)} size="sm" external>
              View dashboard
            </Link>
          </MetaText>
        )}

        {interval && (
          <MetaText direction="column">
            Evaluation interval
            <Text color="primary">Every {interval}</Text>
          </MetaText>
        )}

        {/* TODO truncate, maybe build in to component? */}
        {!isEmpty(labels) && (
          <MetaText direction="column">
            Custom labels
            <AlertLabels labels={labels} size="sm" />
          </MetaText>
        )}
      </Stack>
    </>
  );
};

interface BreadcrumbProps {
  folder: string;
  evaluationGroup: string;
}

const BreadCrumb = ({ folder, evaluationGroup }: BreadcrumbProps) => (
  // TODO fix vertical alignment here
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
  // recording rules don't have a state
  state?: PromAlertingRuleState;
}

const Title = ({ name, state }: TitleProps) => (
  <header>
    <Stack alignItems="center" gap={1}>
      <LinkButton variant="secondary" icon="angle-left" href="/alerting/list" />
      <Text element="h1" variant="h2" weight="bold">
        {name}
      </Text>
      {state && <AlertStateDot size="md" state={state} includeState />}
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
