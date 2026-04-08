import { action } from '@storybook/addon-actions';
import { type Meta, type StoryFn } from '@storybook/react';

import { ConfirmModal } from './ConfirmModal';
import mdx from './ConfirmModal.mdx';

const defaultExcludes = ['onConfirm', 'onDismiss', 'onAlternative'];

const meta: Meta<typeof ConfirmModal> = {
  title: 'Overlays/ConfirmModal',
  component: ConfirmModal,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: defaultExcludes,
    },
  },
  argTypes: {
    body: { control: { type: 'text' } },
    description: { control: { type: 'text' } },
  },
};

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

export const Basic: StoryFn<typeof ConfirmModal> = ({
  title,
  body,
  description,
  confirmText,
  confirmButtonVariant,
  dismissText,
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
      confirmButtonVariant={confirmButtonVariant}
      dismissText={dismissText}
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
  confirmButtonVariant: 'destructive',
  dismissText: 'Cancel',
  isOpen: true,
};

export const AlternativeAction: StoryFn<typeof ConfirmModal> = ({
  title,
  body,
  description,
  confirmText,
  dismissText,
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
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      onAlternative={onAlternative}
    />
  );
};

AlternativeAction.parameters = {
  controls: {
    exclude: [...defaultExcludes, 'confirmationText', 'confirmButtonVariant'],
  },
};

AlternativeAction.args = {
  title: 'Delete row',
  body: 'Are you sure you want to remove this row and all its panels?',
  alternativeText: 'Delete row only',
  confirmText: 'Yes',
  dismissText: 'Cancel',
  isOpen: true,
};

export const WithConfirmation: StoryFn<typeof ConfirmModal> = ({
  title,
  body,
  description,
  confirmationText,
  confirmText,
  dismissText,
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
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
};

WithConfirmation.parameters = {
  controls: {
    exclude: [...defaultExcludes, 'alternativeText', 'confirmButtonVariant'],
  },
};

WithConfirmation.args = {
  title: 'Delete',
  body: 'Do you want to delete this notification channel?',
  description: 'Deleting this notification channel will not delete from alerts any references to it',
  confirmationText: 'Delete',
  confirmText: 'Delete',
  dismissText: 'Cancel',
  isOpen: true,
};

export default meta;
