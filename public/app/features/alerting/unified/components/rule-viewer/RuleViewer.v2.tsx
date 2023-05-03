import { AlertState } from "@grafana/data";
import { Stack } from "@grafana/experimental";
import { Badge, Button, Icon, Tab, TabContent, TabsBar } from "@grafana/ui";
import { GrafanaRouteComponentProps } from "app/core/navigation/types";
import React from "react";
import { useCombinedRule } from "../../hooks/useCombinedRule";

import * as ruleId from '../../utils/rule-id';
import { Spacer } from "../Spacer";

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string
  sourceName: string
}>;


// @TODO
// hook up tabs to query params
// figure out why we needed <AlertingPageWrapper>
const RuleViewer = ({ match }: RuleViewerProps) => {
  const { id } = match.params
  const identifier = ruleId.tryParse(id, true);

  const { loading, error, result: rule } = useCombinedRule(identifier, identifier?.ruleSourceName);

  if (loading) {
    return "Loading..."
  }

  if (error) {
    return String(error)
  }

  if (rule) {
    const description = rule.annotations['description'];

    return (
      <>
        <Stack direction="column" gap={3}>
          <BreadCrumb folder={rule.namespace.name} evaluationGroup={rule.group.name} />
          <Stack direction="column" gap={0.5}>
            <Stack alignItems="center">
              <Title name={rule.name} state={AlertState.Alerting} />
              <Spacer />
              <Stack gap={1}>
                <Button variant="secondary">Edit</Button>
                <Button variant="secondary">More</Button>
              </Stack>
            </Stack>
            {description && <Summary description={description} />}
          </Stack>
          <TabsBar>
            <Tab label="Instances" active />
            <Tab label={"Query"} />
            <TabContent>
            </TabContent>
          </TabsBar>
        </Stack>
      </>
    )
  }

  return null
}

interface BreadcrumbProps {
  folder: string
  evaluationGroup: string
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
)

interface TitleProps {
  name: string
  state: AlertState
}

const Title = ({ name, state }: TitleProps) => {
  return (
    <header>
      <Stack alignItems={"center"}>
        <Stack alignItems={"center"} gap={0.5}>
          <Icon name="angle-left" /> {name}
        </Stack>
        <Badge color="red" text={state} icon="exclamation-circle" />
      </Stack>
    </header>
  )
}

interface SummaryProps {
  description: string
}

const Summary = ({ description }: SummaryProps) => (
  <div>{description}</div>
)

export default RuleViewer;
