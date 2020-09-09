import React from 'react';
import { select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { Alert, AlertVariant } from './Alert';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from '../Alert/Alert.mdx';

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

export const basic = () => {
  const severity = select('Severity', severities, 'info');
  return <Alert title="Some very important message" severity={severity} />;
};

export const withRemove = () => {
  const severity = select('Severity', severities, 'info');
  return <Alert title="Some very important message" severity={severity} onRemove={action('Remove button clicked')} />;
};

export const customButtonContent = () => {
  const severity = select('Severity', severities, 'info');
  return (
    <Alert
      title="Some very important message"
      severity={severity}
      buttonContent={<span>Close</span>}
      onRemove={action('Remove button clicked')}
    />
  );
};
