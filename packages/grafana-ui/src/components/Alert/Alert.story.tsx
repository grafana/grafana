import { action } from '@storybook/addon-actions';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import React from 'react';

import { Alert, AlertVariant, VerticalGroup } from '@grafana/ui';

import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from '../Alert/Alert.mdx';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

const meta: ComponentMeta<typeof Alert> = {
  title: 'Overlays/Alert',
  component: Alert,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
    controls: {},
  },
  argTypes: {
    severity: { control: { type: 'select', options: severities } },
  },
};

export const InlineBanner: ComponentStory<typeof Alert> = (args) => {
  return (
    <div>
      <Alert {...args}>
        <VerticalGroup>
          <div>Child content that includes some alert details, like maybe what actually happened.</div>
        </VerticalGroup>
      </Alert>
      <Alert {...args} onRemove={action('Remove button clicked')} buttonContent={undefined}>
        <VerticalGroup>
          <div>Child content that includes some alert details, like maybe what actually happened.</div>
        </VerticalGroup>
      </Alert>
      <Alert {...args} onRemove={action('Remove button clicked')}>
        <VerticalGroup>
          <div>Child content that includes some alert details, like maybe what actually happened.</div>
        </VerticalGroup>
      </Alert>
    </div>
  );
};

InlineBanner.args = {
  severity: 'error',
  title: 'Title',
  buttonContent: 'Close',
};
InlineBanner.argTypes = {
  buttonContent: {
    control: { type: 'text', default: 'Close' },
  },
};

export const Toast: ComponentStory<typeof Alert> = (args) => {
  return (
    <div className="page-alert-list">
      <Alert {...args} elevated>
        <VerticalGroup>
          <div>Child content that includes some alert details, like maybe what actually happened.</div>
        </VerticalGroup>
      </Alert>
    </div>
  );
};

Toast.args = {
  title: 'Toast',
  severity: 'error',
  onRemove: action('Remove button clicked'),
};
Toast.parameters = {
  controls: {
    exclude: ['onRemove'],
  },
};
export default meta;
