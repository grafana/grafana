import React from 'react';

import { Modal } from '@grafana/ui';

interface TransformationEditorHelperModalProps {
  contentType: string;
  isOpen: boolean;
  onCloseClick: (value: boolean) => void;
}

export const TransformationEditorHelperModal = ({
  contentType,
  isOpen,
  onCloseClick,
}: TransformationEditorHelperModalProps) => {
  const getHelperContent = (contentType: string) => {
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
