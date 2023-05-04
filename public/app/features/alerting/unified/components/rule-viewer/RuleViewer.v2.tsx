import React, { useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Badge, Button, Icon, LoadingPlaceholder, Tab, TabContent, TabsBar } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { useCombinedRule } from '../../hooks/useCombinedRule';
import * as ruleId from '../../utils/rule-id';
import { isAlertingRule } from '../../utils/rules';
import { Spacer } from '../Spacer';

import { History } from './tabs/History';
import { InstancesList } from './tabs/Instances';
import { QueryResults } from './tabs/Query';
import { Routing } from './tabs/Routing';

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
// hook up tabs to query params
// figure out why we needed <AlertingPageWrapper>
const RuleViewer = ({ match }: RuleViewerProps) => {
  const { id } = match.params;
  const identifier = ruleId.tryParse(id, true);
  const [activeTab, setActiveTab] = useState<Tabs>(Tabs.Instances);

  const { loading, error, result: rule } = useCombinedRule(identifier, identifier?.ruleSourceName);

  if (loading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  if (error) {
    return String(error);
  }

  if (rule) {
    const description = rule.annotations['description'];
    const promRule = rule.promRule;

    const isAlertType = isAlertingRule(promRule);
    const numberOfInstance = isAlertType ? promRule.alerts?.length : undefined;

    return (
      <>
        <Stack direction="column" gap={3}>
          <BreadCrumb folder={rule.namespace.name} evaluationGroup={rule.group.name} />
          {/* header */}
          <Stack direction="column" gap={1}>
            <Stack alignItems="center">
              <Title name={rule.name} state={GrafanaAlertState.Alerting} />
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
            {description && <Summary description={description} />}
          </Stack>
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

// @TODO
// make folder and group clickable
const BreadCrumb = ({ folder, evaluationGroup }: BreadcrumbProps) => (
  <Stack alignItems="center" gap={0.5}>
    <Stack alignItems="center" gap={0.5}>
      <Icon name="folder" /> {folder}
    </Stack>
    <div>
      <Icon name="angle-right" /> {evaluationGroup}
    </div>
  </Stack>
);

interface TitleProps {
  name: string;
  state: GrafanaAlertState;
}

const Title = ({ name, state }: TitleProps) => (
  <header>
    <Stack alignItems={'center'} gap={1}>
      <Button variant="secondary" fill="outline" icon="angle-left" /> {name}
      <Badge color="red" text={state} icon="exclamation-circle" />
    </Stack>
  </header>
);

interface SummaryProps {
  description: string;
}

const Summary = ({ description }: SummaryProps) => <div>{description}</div>;

export default RuleViewer;
