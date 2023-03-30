import React from 'react';

import { AppPluginExtensionCommandHelpers } from '@grafana/data';
import { Modal } from '@grafana/ui';

export type ModalWrapperProps = {
  onDismiss: () => void;
};

// Wraps a component with a modal.
// This way we can make sure that the modal is closable, and we also make the usage simpler.
export const getModalWrapper = ({
  // The title of the modal (appears in the header)
  title,
  // A component that serves the body of the modal
  body: Body,
}: Parameters<AppPluginExtensionCommandHelpers['openModal']>[0]) => {
  const ModalWrapper = ({ onDismiss }: ModalWrapperProps) => {
    return (
      <Modal title={title} isOpen onDismiss={onDismiss} onClickBackdrop={onDismiss}>
        <Body onDismiss={onDismiss} />
      </Modal>
    );
  };

  return ModalWrapper;
};
