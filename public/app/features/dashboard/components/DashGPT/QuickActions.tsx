import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';

interface QuickActionsProps {
  onSelectSuggestion: (value: string) => void;
}

interface Suggestion {
  name: string;
  value: string;
}

export const QuickActions = ({ onSelectSuggestion }: QuickActionsProps) => {
  const styles = useStyles2(getStyles);

  const suggestions = [
    {
      name: 'K8s Cluster Metrics',
      value: 'Create a dashboard to see the main metrics of a k8s cluster',
    },
    {
      name: 'Apache HTTP Server',
      value: 'Create a dashboard with the main metrics of an Apache HTTP server',
    },
    {
      name: 'Electricty consumption',
      value: 'Create a dashboard with my house electricity consumption',
    },
  ];

  const onUseSuggestion = (suggestion: Suggestion) => {
    onSelectSuggestion(suggestion.value);
  };

  return (
    <div className={styles.suggestionsWrapper}>
      {suggestions.map((item) => (
        <Card className={styles.suggestionCard} onClick={onUseSuggestion.bind(this, item)} key={item.name}>
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
