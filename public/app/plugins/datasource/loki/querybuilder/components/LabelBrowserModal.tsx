import React from 'react';

import { Modal } from '@grafana/ui';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const LabelBrowserModal = (props: Props) => {
  const { isOpen, onClose } = props;

  return (
    <Modal isOpen={isOpen} title="Label browser" onDismiss={onClose}>
      <div>Label browser content will go here...</div>
    </Modal>
  );
};
