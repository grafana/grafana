import { DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';

import { TransformationOperationRow } from './TransformationOperationRow';
import { TransformationData } from './TransformationsEditor';
import { TransformationsEditorTransformation } from './types';

interface TransformationOperationRowsProps {
  data: TransformationData;
  configs: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
  getIsOpen?: (id: string) => boolean | undefined;
  setIsOpen?: (id: string, isOpen: boolean) => void;
}

export const TransformationOperationRows = ({
  data,
  onChange,
  onRemove,
  configs,
  getIsOpen,
  setIsOpen,
}: TransformationOperationRowsProps) => {
  return (
    <>
      {configs.map((t, i) => {
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
            isOpen={getIsOpen?.(t.id)}
            onOpenChanged={(isOpen) => setIsOpen?.(t.id, isOpen)}
          />
        );
      })}
    </>
  );
};
