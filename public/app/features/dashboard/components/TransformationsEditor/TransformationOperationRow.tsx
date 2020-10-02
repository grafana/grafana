import { DataFrame } from '@grafana/data';
import React, { useState } from 'react';
import { HorizontalGroup } from '@grafana/ui';
import { TransformationEditor } from './TransformationEditor';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';

interface TransformationOperationRowProps {
  id: string;
  index: number;
  name: string;
  description?: string;
  input: DataFrame[];
  output: DataFrame[];
  editor?: JSX.Element;
  onRemove: () => void;
}

export const TransformationOperationRow: React.FC<TransformationOperationRowProps> = ({
  children,
  onRemove,
  index,
  id,
  ...props
}) => {
  const [showDebug, setShowDebug] = useState(false);

  const renderActions = ({ isOpen }: { isOpen: boolean }) => {
    return (
      <HorizontalGroup align="center" width="auto">
        <QueryOperationAction
          title="Debug"
          disabled={!isOpen}
          icon="bug"
          onClick={() => {
            setShowDebug(!showDebug);
          }}
        />

        <QueryOperationAction title="Remove" icon="trash-alt" onClick={onRemove} />
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow id={id} index={index} title={props.name} draggable actions={renderActions}>
      <TransformationEditor {...props} debugMode={showDebug} />
    </QueryOperationRow>
  );
};
