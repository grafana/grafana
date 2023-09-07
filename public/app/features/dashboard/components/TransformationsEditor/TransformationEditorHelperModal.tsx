import React from 'react';

import { Modal } from '@grafana/ui';

import { getHelperContent } from './HelperContent/getHelperContent';

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
  // JEV: get content and title both here
  const { title, content } = getHelperContent(contentType);

  const helpTitle = `${title} - Transformation help`;

  return (
    <Modal
      title={helpTitle}
      isOpen={isOpen}
      onClickBackdrop={() => onCloseClick(false)}
      onDismiss={() => onCloseClick(false)}
    >
      {/* JEV: figure out how to remove this */}
      {content}
    </Modal>
  );
};
