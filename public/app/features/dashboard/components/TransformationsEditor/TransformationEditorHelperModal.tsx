import React from 'react';

import { TransformerRegistryItem } from '@grafana/data';
import { Modal } from '@grafana/ui';

interface TransformationEditorHelperModalProps {
  isOpen: boolean;
  onCloseClick: (value: boolean) => void;
  transformer: TransformerRegistryItem<null>;
}

export const TransformationEditorHelperModal = ({
  isOpen,
  onCloseClick,
  transformer,
}: TransformationEditorHelperModalProps) => {
  // console.log(transformer, 'transformer');
  const {
    transformation: { name },
    help,
  } = transformer;

  // console.log(help, 'help');

  const helpTitle = `Transformation help - ${name}`;

  return (
    <Modal
      title={helpTitle}
      isOpen={isOpen}
      onClickBackdrop={() => onCloseClick(false)}
      onDismiss={() => onCloseClick(false)}
    >
      {help}
    </Modal>
  );
};
