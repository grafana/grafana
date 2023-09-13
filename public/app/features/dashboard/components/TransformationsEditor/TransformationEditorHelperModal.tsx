import React from 'react';

import { TransformerRegistryItem } from '@grafana/data';
import { Modal } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';

import { getLinkToDocs } from '../../../transformers/helpers/getLinkToDocs';

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
  const {
    transformation: { name },
    help,
  } = transformer;

  const helpContent = help ? help : getLinkToDocs();

  const helpTitle = `Transformation help - ${name}`;

  return (
    <Modal
      title={helpTitle}
      isOpen={isOpen}
      onClickBackdrop={() => onCloseClick(false)}
      onDismiss={() => onCloseClick(false)}
    >
      <OperationRowHelp markdown={helpContent} styleOverrides={{ borderTop: '2px solid' }} />
    </Modal>
  );
};
