import { isEmpty, truncate } from 'lodash';
import React, { useMemo } from 'react';

import { UrlQueryValue } from '@grafana/data';
import {
  Alert,
  Button,
  Dropdown,
  Icon,
  LinkButton,
  LoadingPlaceholder,
  Menu,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  Text,
} from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { RuleIdentifier } from 'app/types/unified-alerting';
import { Annotations, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { useRuleViewerPageTitle } from '../../../hooks/alert-details/useRuleViewerPageTitle';
import { useCombinedRule } from '../../../hooks/useCombinedRule';
import { useIsRuleEditable } from '../../../hooks/useIsRuleEditable';
import { getRulesPermissions } from '../../../utils/access-control';
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
import { createUrl } from '../../../utils/url';
import { AlertLabels } from '../../AlertLabels';
import { AlertStateDot } from '../../AlertStateDot';
import { Link } from '../../ExternalLink';
import { MetaText } from '../../MetaText';
import MoreButton from '../../MoreButton';
import { ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { Spacer } from '../../Spacer';
import { DeclareIncidentMenuItem } from '../../bridges/DeclareIncidentButton';
import { useCanSilence } from '../../rules/RuleDetailsActionButtons';
import { Details } from '../tabs/Details';
import { History } from '../tabs/History';
import { InstancesList } from '../tabs/Instances';
import { QueryResults } from '../tabs/Query';
import { Routing } from '../tabs/Routing';

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

enum ActiveTab {
  Query = 'query',
  Instances = 'instances',
  History = 'history',
  Routing = 'routing',
  Details = 'details',
}

// @TODO
// hook up tabs to query params or path segment
// figure out why we needed <AlertingPageWrapper>
// add provisioning and federation stuff back in
const RuleViewer = ({ match }: RuleViewerProps) => {
  const [activeTab, setActiveTab] = useActiveTab();

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

  /**
   * Figure out if edit / create / delete is supported and allowed
   * TODO refactor this, very confusing right now
   */
  const { isEditable, isRemovable } = useIsRuleEditable(identifier.ruleSourceName, rule?.rulerRule);
  const rulesPermissions = getRulesPermissions(identifier.ruleSourceName);
  const hasCreateRulePermission = contextSrv.hasPermission(rulesPermissions.create);
  const canSilence = useCanSilence(rule);

  if (loading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  // TODO improve error handling here
  if (error) {
    if (typeof error === 'string') {
      return error;
    }

    return <Alert title={'Uh-oh'}>Something went wrong loading the rule</Alert>;
  }

  if (rule) {
    // should fit in a tweet
    const summary = rule.annotations[Annotation.summary];
    const promRule = rule.promRule;

    const isAlertType = isAlertingRule(promRule);
    const isGrafanaManagedRule = isGrafanaRulerRule(rule.rulerRule);
    const numberOfInstance = isAlertType ? (promRule.alerts ?? []).length : undefined;

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
        <Stack direction="column" gap={3}>
          {/* breadcrumb and actions */}
          <BreadCrumbs folder={rule.namespace.name} evaluationGroup={rule.group.name} />

          <Stack direction="column" gap={2}>
            {/* header */}
            <Stack direction="column" gap={1}>
              <Stack direction="row" alignItems="center">
                {/* // TODO normalize states from prom to grafana and pass to title */}
                <Title name={rule.name} state={isAlertType ? promRule.state : undefined} />
                <Spacer />
                <Stack gap={1}>
                  {isEditable && <EditButton identifier={identifier} />}
                  <Dropdown
                    overlay={
                      <Menu>
                        {/* TODO hook these up to actions and move to separate component */}
                        {canSilence && <Menu.Item label="Silence" icon="bell-slash" />}
                        {shouldShowDeclareIncidentButton && (
                          <DeclareIncidentMenuItem title={rule.name} url={buildShareUrl()} />
                        )}
                        {isGrafanaManagedRule && hasCreateRulePermission && !isFederatedRule && (
                          <Menu.Item label="Duplicate" icon="copy" />
                        )}
                        <Menu.Divider />
                        <Menu.Item
                          label="Copy link"
                          icon="clipboard-alt"
                          onClick={() => {
                            if (navigator.clipboard) {
                              const url = buildShareUrl();
                              navigator.clipboard.writeText(url);
                            }
                          }}
                        />
                        {/* TODO - RBAC check for these actions! */}
                        <Menu.Item
                          label="Export"
                          icon="download-alt"
                          childItems={[
                            <Menu.Item key="no-modifications" label="Without modifications" icon="file-blank" />,
                            <Menu.Item key="with-modifications" label="With modifications" icon="file-alt" />,
                          ]}
                        />
                        {isRemovable && !isFederatedRule && !isProvisioned && (
                          <>
                            <Menu.Divider />
                            <Menu.Item label="Delete" icon="trash-alt" destructive />
                          </>
                        )}
                      </Menu>
                    }
                  >
                    <MoreButton size="md" />
                  </Dropdown>
                </Stack>
              </Stack>
              {summary ? (
                <Summary text={summary} />
              ) : (
                <Button size="sm" fill="text" variant="secondary" style={{ alignSelf: 'start' }}>
                  <Text variant="bodySmall" color="secondary" italic>
                    Click to add a summary <Icon name="pen" />
                  </Text>
                </Button>
              )}
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
            {/* TODO persist tab to query params */}
            <TabsBar>
              <Tab
                label="Query and conditions"
                onChangeTab={() => setActiveTab(ActiveTab.Query)}
                active={activeTab === ActiveTab.Query}
              />
              <Tab
                label="Instances"
                counter={numberOfInstance}
                onChangeTab={() => setActiveTab(ActiveTab.Instances)}
                active={activeTab === ActiveTab.Instances}
              />
              <Tab
                label="History"
                onChangeTab={() => setActiveTab(ActiveTab.History)}
                active={activeTab === ActiveTab.History}
              />
              {/* <Tab label="Routing" onChangeTab={() => setActiveTab(Tabs.Routing)} active={activeTab === Tabs.Routing} /> */}
              <Tab
                label="Details"
                onChangeTab={() => setActiveTab(ActiveTab.Details)}
                active={activeTab === ActiveTab.Details}
              />
            </TabsBar>
            <TabContent>
              {activeTab === ActiveTab.Query && <QueryResults rule={rule} />}
              {activeTab === ActiveTab.Instances && <InstancesList rule={rule} />}
              {activeTab === ActiveTab.History && isGrafanaRulerRule(rule.rulerRule) && (
                <History rule={rule.rulerRule} />
              )}
              {activeTab === ActiveTab.Routing && <Routing />}
              {activeTab === ActiveTab.Details && <Details rule={rule} />}
            </TabContent>
          </Stack>
        </Stack>
      </>
    );
  }

  return null;
};

interface EditButtonProps {
  identifier: RuleIdentifier;
}

const EditButton = ({ identifier }: EditButtonProps) => {
  const returnTo = location.pathname + location.search;
  const ruleIdentifier = ruleId.stringifyIdentifier(identifier);
  const editURL = createUrl(`/alerting/${encodeURIComponent(ruleIdentifier)}/edit`, { returnTo });

  return (
    <LinkButton variant="secondary" icon="pen" href={editURL}>
      Edit
    </LinkButton>
  );
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
              {/* TODO instead of truncating the string, we should use flex and text overflow properly to allow it to take up all of the horizontal space available */}
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

const BreadCrumbs = ({ folder, evaluationGroup }: BreadcrumbProps) => (
  // TODO fix vertical alignment here
  // TODO make folder and group clickable -> use list filter(s)
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
      {/* recording rules won't have a state */}
      {state && <StateBadge state={state} />}
    </Stack>
  </header>
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

interface SummaryProps {
  text: string;
}

const Summary = ({ text }: SummaryProps) => (
  <Text variant="body" color="secondary">
    {text}
  </Text>
);

export default RuleViewer;

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
