import React, { useState } from 'react';
import { DataFrame, DataTransformerConfig, TransformerRegistyItem } from '@grafana/data';
import { HorizontalGroup } from '@grafana/ui';

import { TransformationEditor } from './TransformationEditor';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { TransformationsEditorTransformation } from './types';

interface TransformationOperationRowProps {
  id: string;
  index: number;
  data: DataFrame[];
  transformationUI: TransformerRegistyItem<any>;
  transformations: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRow: React.FC<TransformationOperationRowProps> = ({
  onRemove,
  index,
  id,
  data,
  transformations,
  transformationUI,
  onChange,
}) => {
  const [showDebug, setShowDebug] = useState(false);

  const renderActions = ({ isOpen }: { isOpen: boolean }) => {
    return (
      <HorizontalGroup align="center">
        <QueryOperationAction
          title="Debug"
          disabled={!isOpen}
          icon="bug"
          onClick={() => {
            setShowDebug(!showDebug);
          }}
        />

        <QueryOperationAction title="Remove" icon="trash-alt" onClick={() => onRemove(index)} />
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow id={id} index={index} title={transformationUI.name} draggable actions={renderActions}>
      <TransformationEditor
        debugMode={showDebug}
        index={index}
        data={data}
        transformations={transformations}
        transformationUI={transformationUI}
        onChange={onChange}
      />
    </QueryOperationRow>
  );
};
