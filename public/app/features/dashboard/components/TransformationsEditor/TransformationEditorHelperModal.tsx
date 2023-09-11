import React from 'react';

import { TransformerRegistryItem } from '@grafana/data';
import { Modal } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';

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

  // Some help content is rendered more suitably as markdown - small illustrative tables, for example.
  // But some is more suitably handled as jsx. The help content will never be both.
  // This quick check is to determine which it is.
  // If it's a string, it's markdown. If it's not, it's jsx.
  const markdown = typeof help === 'string' ? help : undefined;
  const jsx = typeof help !== 'string' ? help : undefined;

  // console.log(help, 'help');

  const helpTitle = `Transformation help - ${name}`;

  return (
    <Modal
      title={helpTitle}
      isOpen={isOpen}
      onClickBackdrop={() => onCloseClick(false)}
      onDismiss={() => onCloseClick(false)}
    >
      <OperationRowHelp markdown={markdown} styleOverrides={{ borderTop: true }}>
        {jsx}
      </OperationRowHelp>
    </Modal>
  );
};
