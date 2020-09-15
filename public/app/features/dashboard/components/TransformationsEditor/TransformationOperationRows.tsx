import React from 'react';
import { DataFrame, DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';

import { TransformationOperationRow } from './TransformationOperationRow';
import { TransformationsEditorTransformation } from './types';

interface TransformationOperationRowsProps {
  data: DataFrame[];
  transformations: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRows: React.FC<TransformationOperationRowsProps> = ({
  data,
  onChange,
  onRemove,
  transformations,
}) => {
  return (
    <>
      {transformations.map((t, i) => {
        const transformationUI = standardTransformersRegistry.getIfExists(t.transformation.id);
        if (!transformationUI) {
          return null;
        }

        return (
          <TransformationOperationRow
            index={i}
            id={`${t.id}`}
            key={`${t.id}`}
            data={data}
            transformations={transformations}
            transformationUI={transformationUI}
            onRemove={onRemove}
            onChange={onChange}
          />
        );
      })}
    </>
  );
};
