import { action } from '@storybook/addon-actions';
import { StoryFn, Meta } from '@storybook/react';
import React from 'react';

import { Alert, AlertVariant, VerticalGroup } from '@grafana/ui';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './Alert.mdx';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

const meta: Meta = {
  title: 'Overlays/Alert/InlineBanner',
  component: Alert,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['onRemove'] },
  },
  argTypes: {
    severity: {
      control: { type: 'select', options: severities },
    },
  },
};

export const Basic: StoryFn<typeof Alert> = (args) => {
  return (
    <div>
      <Alert {...args}>
        <VerticalGroup>
          <div>Child content that includes some alert details, like maybe what actually happened.</div>
        </VerticalGroup>
      </Alert>
    </div>
  );
};

Basic.args = {
  severity: 'error',
  title: 'Basic',
};

export const WithActions: StoryFn<typeof Alert> = (args) => {
  return (
    <Alert {...args}>
      <VerticalGroup>
        <div>Child content that includes some alert details, like maybe what actually happened.</div>
      </VerticalGroup>
    </Alert>
  );
};

WithActions.args = {
  title: 'With action',
  severity: 'error',
  onRemove: action('Remove button clicked'),
  buttonContent: 'Close',
};

export const Examples: ComponentStory<typeof Alert> = () => {
  return (
    <VerticalGroup>
      <StoryExample name="With buttonContent and children">
        <Alert
          title={'The title of the alert'}
          severity={'error'}
          buttonContent={<span>Close</span>}
          onRemove={action('Remove button clicked')}
        >
          Child content that includes some alert details, like maybe what actually happened
        </Alert>
      </StoryExample>
      <StoryExample name="No dismiss">
        <Alert title={'No dismiss'} severity={'success'} />
      </StoryExample>
      <StoryExample name="Severities">
        <VerticalGroup>
          {severities.map((severity) => (
            <Alert title={`Severity: ${severity}`} severity={severity} key={severity}>
              Child content
            </Alert>
          ))}
        </VerticalGroup>
      </StoryExample>
    </VerticalGroup>
  );
};

export default meta;
