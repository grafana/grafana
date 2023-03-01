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
    onRemove: {
      description: "To show a button or a close icon, select 'function'. To get rid of them, select 'undefined'",
      control: { type: 'select', options: [action('Remove button clicked'), undefined] },
    },
    buttonContent: {
      description: "To show an example of button, select 'Close', otherwise, select 'undefined'",
      control: { type: 'select', options: ['Close', undefined] },
    },
  },
};

export const InlineBanner: ComponentStory<typeof Alert> = ({ severity, title, buttonContent, onRemove }) => {
  return (
    <Alert
      title={title}
      severity={severity}
      buttonContent={buttonContent ? <span>{buttonContent}</span> : ''}
      onRemove={onRemove ? onRemove : undefined}
    >
      <VerticalGroup>
        <div>Child content that includes some alert details, like maybe what actually happened.</div>
      </VerticalGroup>
    </Alert>
  );
};

InlineBanner.args = {
  severity: 'error',
  title: 'Title',
  buttonContent: 'Close',
  onRemove: action('Remove button clicked'),
};

InlineBanner.parameters = {
  controls: { expanded: true },
};

export default meta;
