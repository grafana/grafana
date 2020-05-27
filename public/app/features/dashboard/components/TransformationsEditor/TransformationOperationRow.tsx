import { DataFrame } from '@grafana/data';
import React, { useState } from 'react';
import { HorizontalGroup } from '@grafana/ui';
import { TransformationEditor } from './TransformationEditor';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';

interface TransformationOperationRowProps {
  name: string;
  description: string;
  editor?: JSX.Element;
  onRemove: () => void;
  input: DataFrame[];
  output: DataFrame[];
}

export const TransformationOperationRow: React.FC<TransformationOperationRowProps> = ({
  children,
  onRemove,
  ...props
}) => {
  const [showDebug, setShowDebug] = useState(false);

  const renderActions = ({ isOpen }: { isOpen: boolean }) => {
    return (
      <HorizontalGroup align="center">
        <QueryOperationAction
          disabled={!isOpen}
          icon="bug"
          onClick={() => {
            setShowDebug(!showDebug);
          }}
        />

        <QueryOperationAction icon="trash-alt" onClick={onRemove} />
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow title={props.name} actions={renderActions}>
      <TransformationEditor {...props} debugMode={showDebug} />
    </QueryOperationRow>
  );
};
