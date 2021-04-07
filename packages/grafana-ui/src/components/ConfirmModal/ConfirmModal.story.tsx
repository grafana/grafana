import React from 'react';
import { Meta, Story } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ConfirmModal } from '@grafana/ui';
import mdx from './ConfirmModal.mdx';
import { Props } from './ConfirmModal';

export default {
  title: 'Overlays/ConfirmModal',
  component: ConfirmModal,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
    controls: {
      exclude: ['isOpen', 'body'],
    },
  },
  argTypes: {
    icon: { control: { type: 'select', options: ['exclamation-triangle', 'power', 'cog', 'lock'] } },
  },
} as Meta;

const defaultActions = {
  onConfirm: () => {
    action('Confirmed')('delete');
  },
  onDismiss: () => {
    action('Dismiss')('close');
  },
};

interface StoryProps extends Props {
  visible: boolean;
  bodyText: string;
}

export const Basic: Story<StoryProps> = ({ title, bodyText, confirmText, dismissText, icon, visible }) => {
  const { onConfirm, onDismiss } = defaultActions;
  return (
    <ConfirmModal
      isOpen={visible}
      title={title}
      body={bodyText}
      confirmText={confirmText}
      dismissText={dismissText}
      icon={icon}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
};

Basic.args = {
  title: 'Delete user',
  bodyText: 'Are you sure you want to delete this user?',
  confirmText: 'Delete',
  dismissText: 'Cancel',
  icon: 'exclamation-triangle',
  visible: true,
};
