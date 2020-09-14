import React from 'react';
import { DataFrame, DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { TransformationOperationRow } from './TransformationOperationRow';

interface TransformationsEditorTransformation {
  transformation: DataTransformerConfig;
  id: string;
}

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

        const options = { ...transformationUI.transformation.defaultOptions, ...t.transformation.options };

        return (
          <TransformationOperationRow
            index={i}
            id={`${t.id}`}
            key={`${t.id}`}
            data={data}
            transformations={transformations}
            name={transformationUI.name}
            description={transformationUI.description}
            options={options}
            editor={transformationUI.editor}
            onRemove={onRemove}
            onChange={onChange}
          />
        );
      })}
    </>
  );
};
