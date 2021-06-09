import React from 'react';
import { Meta, Story } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ConfirmModal } from '@grafana/ui';
import mdx from './ConfirmModal.mdx';
import { ConfirmModalProps } from './ConfirmModal';

const defaultExcludes = ['onConfirm', 'onDismiss', 'onAlternative'];

export default {
  title: 'Overlays/ConfirmModal',
  component: ConfirmModal,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: defaultExcludes,
    },
  },
  argTypes: {
    icon: { control: { type: 'select', options: ['exclamation-triangle', 'power', 'cog', 'lock', 'trash-alt'] } },
    body: { control: { type: 'text' } },
    description: { control: { type: 'text' } },
  },
} as Meta;

const defaultActions = {
  onConfirm: () => {
    action('Confirmed')('delete');
  },
  onDismiss: () => {
    action('Dismiss')('close');
  },
  onAlternative: () => {
    action('Alternative')('alternative');
  },
};

export const Basic: Story<ConfirmModalProps> = ({
  title,
  body,
  description,
  confirmText,
  dismissText,
  icon,
  isOpen,
}) => {
  const { onConfirm, onDismiss } = defaultActions;
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      body={body}
      description={description}
      confirmText={confirmText}
      dismissText={dismissText}
      icon={icon}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
};

Basic.parameters = {
  controls: {
    exclude: [...defaultExcludes, 'alternativeText', 'confirmationText'],
  },
};

Basic.args = {
  title: 'Delete user',
  body: 'Are you sure you want to delete this user?',
  description: 'Removing the user will not remove any dashboards the user has created',
  confirmText: 'Delete',
  dismissText: 'Cancel',
  icon: 'exclamation-triangle',
  isOpen: true,
};

export const AlternativeAction: Story<ConfirmModalProps> = ({
  title,
  body,
  description,
  confirmText,
  dismissText,
  icon,
  alternativeText,
  isOpen,
}) => {
  const { onConfirm, onDismiss, onAlternative } = defaultActions;
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      body={body}
      description={description}
      confirmText={confirmText}
      dismissText={dismissText}
      alternativeText={alternativeText}
      icon={icon}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      onAlternative={onAlternative}
    />
  );
};

AlternativeAction.parameters = {
  controls: {
    exclude: [...defaultExcludes, 'confirmationText'],
  },
};

AlternativeAction.args = {
  title: 'Delete row',
  body: 'Are you sure you want to remove this row and all its panels?',
  alternativeText: 'Delete row only',
  confirmText: 'Yes',
  dismissText: 'Cancel',
  icon: 'trash-alt',
  isOpen: true,
};

export const WithConfirmation: Story<ConfirmModalProps> = ({
  title,
  body,
  description,
  confirmationText,
  confirmText,
  dismissText,
  icon,
  isOpen,
}) => {
  const { onConfirm, onDismiss } = defaultActions;
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      body={body}
      confirmationText={confirmationText}
      description={description}
      confirmText={confirmText}
      dismissText={dismissText}
      icon={icon}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
};

WithConfirmation.parameters = {
  controls: {
    exclude: [...defaultExcludes, 'alternativeText'],
  },
};

WithConfirmation.args = {
  title: 'Delete',
  body: 'Do you want to delete this notification channel?',
  description: 'Deleting this notification channel will not delete from alerts any references to it',
  confirmationText: 'Delete',
  confirmText: 'Delete',
  dismissText: 'Cancel',
  icon: 'trash-alt',
  isOpen: true,
};
