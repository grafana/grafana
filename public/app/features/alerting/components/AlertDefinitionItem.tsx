import React, { FC } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { FeatureState } from '@grafana/data';
import { Card, FeatureBadge, Icon, LinkButton } from '@grafana/ui';
import { AlertDefinition } from 'app/types';

interface Props {
  alertDefinition: AlertDefinition;
  search: string;
}

export const AlertDefinitionItem: FC<Props> = ({ alertDefinition, search }) => {
  return (
    <Card heading={CardTitle(alertDefinition.title, search)}>
      <Card.Figure>
        <Icon size="xl" name="question-circle" className="alert-rule-item__icon" />
      </Card.Figure>
      <Card.Meta>
        <span key="state">
          <span key="text">{alertDefinition.description}</span>
        </span>
      </Card.Meta>
      <Card.Actions>
        {[
          <LinkButton key="edit" variant="secondary" href={`/alerting/${alertDefinition.uid}/edit`} icon="cog">
            Edit alert
          </LinkButton>,
        ]}
      </Card.Actions>
    </Card>
  );
};

const CardTitle = (title: string, search: string) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
    <Highlighter
      key={title}
      highlightClassName="highlight-search-match"
      textToHighlight={title}
      searchWords={[search]}
    />
    <FeatureBadge featureState={FeatureState.beta} />
  </div>
);
