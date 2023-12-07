import React from 'react';

import { TransformerRegistryItem } from '@grafana/data';
import { Drawer } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';

import { getLinkToDocs } from '../../../transformers/docs/content';

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
  const helpElement = (
    <Drawer title="Transformation help" subtitle={name} onClose={() => onCloseClick(false)}>
      <OperationRowHelp markdown={helpContent} styleOverrides={{ borderTop: '2px solid' }} />
    </Drawer>
  );

  return isOpen ? helpElement : null;
};
