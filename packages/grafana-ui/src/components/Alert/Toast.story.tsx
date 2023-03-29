import { action } from '@storybook/addon-actions';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import React from 'react';

import { Alert, AlertVariant, VerticalGroup } from '@grafana/ui';

import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from '../Alert/Alert.mdx';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

const meta: ComponentMeta<typeof Alert> = {
  title: 'Overlays/Alert/Toast',
  component: Alert,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['onRemove'] },
  },
  argTypes: {
    severity: { control: { type: 'select', options: severities } },
  },
  args: {
    title: 'Toast',
    severity: 'error',
    onRemove: action('Remove button clicked'),
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

export default meta;
