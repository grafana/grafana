import React from 'react';
import { text, boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ConfirmModal } from './ConfirmModal';
import mdx from './ConfirmModal.mdx';

const getKnobs = () => {
  return {
    title: text('Title', 'Delete user'),
    body: text('Body', 'Are you sure you want to delete this user?'),
    confirm: text('Confirm', 'Delete'),
    visible: boolean('Visible', true),
    icon: select('Icon', ['exclamation-triangle', 'power', 'cog', 'lock'], 'exclamation-triangle'),
  };
};

const defaultActions = {
  onConfirm: () => {
    action('Confirmed')('delete');
  },
  onDismiss: () => {
    action('Dismiss')('close');
  },
};

export default {
  title: 'Overlays/ConfirmModal',
  component: ConfirmModal,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  const { title, body, confirm, icon, visible } = getKnobs();
  const { onConfirm, onDismiss } = defaultActions;
  return (
    <ConfirmModal
      isOpen={visible}
      title={title}
      body={body}
      confirmText={confirm}
      icon={icon}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
};
