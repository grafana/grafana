import React from 'react';
import { action } from '@storybook/addon-actions';
import { Alert, AlertVariant, VerticalGroup } from '@grafana/ui';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from '../Alert/Alert.mdx';
import { StoryExample } from '../../utils/storybook/StoryExample';

export default {
  title: 'Overlays/Alert',
  component: Alert,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

export const Examples = () => {
  return (
    <VerticalGroup>
      <StoryExample name="With buttonContent and children">
        <Alert
          title="Some very important message"
          severity="error"
          buttonContent={<span>Close</span>}
          onRemove={action('Remove button clicked')}
        >
          Child content that includes some alert details, like maybe what actually happened.
        </Alert>
      </StoryExample>
      <StoryExample name="No dismiss">
        <Alert title="Some very important message" severity="info" />
      </StoryExample>
      <StoryExample name="Severities">
        <VerticalGroup>
          {severities.map((severity) => (
            <Alert
              title={`Severity: ${severity}`}
              severity={severity}
              key={severity}
              onRemove={action('Remove button clicked')}
            />
          ))}
        </VerticalGroup>
      </StoryExample>
    </VerticalGroup>
  );
};
