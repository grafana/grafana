import React, { FC } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { Card, FeatureBadge, Icon } from '@grafana/ui';
import { AlertDefinition } from 'app/types';
import { FeatureState } from '@grafana/data';

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
