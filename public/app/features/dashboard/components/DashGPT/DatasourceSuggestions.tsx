import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';

interface DatasourceSuggestionsProps {
  onSelectSuggestion: (value: string) => void;
}

interface Suggestion {
  name: string;
  value: string;
}

export const DatasourceSuggestions = ({ onSelectSuggestion }: DatasourceSuggestionsProps) => {
  const styles = useStyles2(getStyles);

  const datasourceSuggestions = [
    {
      name: 'K8s Cluster Overview',
      value: 'Create a dashboard to overview my kubernetes cluster',
    },
    {
      name: 'K8s Workload',
      value: 'Create a dashboard to see the main metrics of a kubernetes workload',
    },
    {
      name: 'Apache HTTP Server',
      value: 'Create a dashboard with the main metrics of an Apache HTTP server',
    },
  ];

  const onUseDatasourceSuggestion = (suggestion: Suggestion) => {
    onSelectSuggestion(suggestion.value);
  };

  return (
    <div className={styles.suggestionsWrapper}>
      {datasourceSuggestions.map((item) => (
        <Card className={styles.suggestionCard} onClick={onUseDatasourceSuggestion.bind(this, item)} key={item.name}>
          <Card.Heading className={styles.suggestionDescription}>{item.name}</Card.Heading>
          <Card.Description className={styles.suggestionDescription}>{item.value}</Card.Description>
        </Card>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  suggestionsWrapper: css`
    display: flex;
    gap: 10px;
  `,
  suggestionCard: css`
    padding: ${theme.spacing(2)};
  `,
  suggestionDescription: css`
    font-size: ${theme.typography.size.sm};
  `,
});
