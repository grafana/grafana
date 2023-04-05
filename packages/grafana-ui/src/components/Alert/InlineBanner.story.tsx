import { action } from '@storybook/addon-actions';
import { ComponentStory, Meta } from '@storybook/react';
import React from 'react';

import { Alert, AlertVariant, VerticalGroup } from '@grafana/ui';

import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from '../Alert/Alert.mdx';

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

export const Basic: ComponentStory<typeof Alert> = (args) => {
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

export const WithActions: ComponentStory<typeof Alert> = (args) => {
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

export default meta;
