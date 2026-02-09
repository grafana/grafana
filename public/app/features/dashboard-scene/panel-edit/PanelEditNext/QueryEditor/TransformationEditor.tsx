import { useCallback } from 'react';

import { DataTransformerConfig, DataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Transformation } from './types';

interface TransformationEditorProps {
  transformation: Transformation;
  inputData: DataFrame[];
  onUpdate: (oldConfig: DataTransformerConfig, newConfig: DataTransformerConfig) => void;
}

export function TransformationEditor({ transformation, inputData, onUpdate }: TransformationEditorProps) {
  const { registryItem, transformConfig } = transformation;

  const handleChange = useCallback(
    (opts: Record<string, unknown>) => {
      const updatedConfig = { ...transformConfig, options: opts };
      onUpdate(transformConfig, updatedConfig);
    },
    [transformConfig, onUpdate]
  );

  const Editor = registryItem!.editor!;

  return (
    <div data-testid={selectors.components.TransformTab.transformationEditor(registryItem?.name || '')}>
      <Editor
        input={inputData}
        onChange={handleChange}
        options={{ ...registryItem!.transformation.defaultOptions, ...transformConfig.options }}
      />
    </div>
  );
}
