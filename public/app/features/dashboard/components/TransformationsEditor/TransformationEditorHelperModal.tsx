import React from 'react';

import { DataTransformerID } from '@grafana/data';
import { Modal } from '@grafana/ui';

interface TransformationEditorHelperModalProps {
  contentType: DataTransformerID;
  isOpen: boolean;
  onCloseClick: (value: boolean) => void;
}

export const TransformationEditorHelperModal = ({
  contentType,
  isOpen,
  onCloseClick,
}: TransformationEditorHelperModalProps) => {
  const getHelperContent = (contentType: DataTransformerID) => {
    return <></>;
  };

  return (
    <Modal
      title="Transformation help"
      isOpen={isOpen}
      onClickBackdrop={() => onCloseClick(false)}
      onDismiss={() => onCloseClick(false)}
    >
      {getHelperContent(contentType)}
    </Modal>
  );
};
