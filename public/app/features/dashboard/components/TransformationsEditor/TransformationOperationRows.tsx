import { memo } from 'react';

import { DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';

import { TransformationOperationRow } from './TransformationOperationRow';
import { TransformationData } from './TransformationsEditor';
import { TransformationsEditorTransformation } from './types';

interface TransformationOperationRowsProps {
  data: TransformationData;
  configs: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
  selectedIdx?: number;
}

export const TransformationOperationRows = memo(
  ({ data, onChange, onRemove, configs, selectedIdx }: TransformationOperationRowsProps) => {
    if (selectedIdx != null) {
      const t = configs[selectedIdx];
      if (!t) {
        return null;
      }

      const uiConfig = standardTransformersRegistry.getIfExists(t.transformation.id);
      if (!uiConfig) {
        return null;
      }

      return (
        <TransformationOperationRow
          index={selectedIdx}
          id={`${t.id}`}
          key={`${t.id}`}
          data={data}
          configs={configs}
          uiConfig={uiConfig}
          onRemove={onRemove}
          onChange={onChange}
        />
      );
    }

    return configs.map((t, i) => {
      const uiConfig = standardTransformersRegistry.getIfExists(t.transformation.id);
      if (!uiConfig) {
        return null;
      }

      return (
        <TransformationOperationRow
          index={i}
          id={`${t.id}`}
          key={`${t.id}`}
          data={data}
          configs={configs}
          uiConfig={uiConfig}
          onRemove={onRemove}
          onChange={onChange}
        />
      );
    });
  }
);

TransformationOperationRows.displayName = 'TransformationOperationRows';
