import React from 'react';
import { Button, Card, Stack, Text } from '@grafana/ui';
import { Trans } from '@grafana/i18n';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  panelCount: number;
}

const templates: Template[] = [
  {
    id: 'server-monitoring',
    name: 'Server Monitoring',
    description: 'CPU, Memory, Disk, Network metrics',
    category: 'Infrastructure',
    panelCount: 8,
  },
  {
    id: 'application-performance',
    name: 'Application Performance',
    description: 'Response times, error rates, throughput',
    category: 'Application',
    panelCount: 6,
  },
  {
    id: 'business-metrics',
    name: 'Business Metrics',
    description: 'KPIs, revenue, user engagement',
    category: 'Business',
    panelCount: 4,
  },
];

interface Props {
  onTemplateSelect: (templateId: string) => void;
}

export const DashboardTemplates: React.FC<Props> = ({ onTemplateSelect }) => {
  return (
    <Stack direction="column" gap={2}>
      <Text variant="h4">
        <Trans i18nKey="dashboard.templates.title">Quick Start Templates</Trans>
      </Text>
      <Stack direction="row" gap={2} wrap="wrap">
        {templates.map((template) => (
          <Card key={template.id} style={{ width: 300 }}>
            <Card.Heading>{template.name}</Card.Heading>
            <Card.Description>{template.description}</Card.Description>
            <Card.Meta>
              {template.category} • {template.panelCount} panels
            </Card.Meta>
            <Card.Actions>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onTemplateSelect(template.id)}
              >
                <Trans i18nKey="dashboard.templates.use">Use Template</Trans>
              </Button>
            </Card.Actions>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
};