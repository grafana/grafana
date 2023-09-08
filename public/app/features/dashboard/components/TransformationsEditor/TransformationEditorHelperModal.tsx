import React from 'react';

import { TransformerRegistryItem } from '@grafana/data';
import { Modal } from '@grafana/ui';

import { getHelperContent } from './HelperContent/getHelperContent';

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
  // JEV: get content and title both here
  // const { title, content } = getHelperContent(transformation);

  const {
    transformation: { id, name, description },
    help,
  } = transformer;

  const helpTitle = `${name} - Transformation help`;

  return (
    <Modal
      title={helpTitle}
      isOpen={isOpen}
      onClickBackdrop={() => onCloseClick(false)}
      onDismiss={() => onCloseClick(false)}
    >
      {"conte nt"}
    </Modal>
  );
};
