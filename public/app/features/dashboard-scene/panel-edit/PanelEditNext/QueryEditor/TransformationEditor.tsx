import { useCallback } from 'react';

import { DataTransformerID, type DataTransformerConfig } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { selectors } from '@grafana/e2e-selectors';

import { NoOptionsIndicator } from './NoOptionsIndicator';
import { type Transformation } from './types';

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

  const showNoOptions =
    transformConfig.id === DataTransformerID.seriesToRows ||
    (transformConfig.id === DataTransformerID.merge && inputData.length > 1);

  const Editor = registryItem!.editor!;

  return (
    <div data-testid={selectors.components.TransformTab.transformationEditor(registryItem?.name || '')}>
      <Editor
        input={inputData}
        onChange={handleChange}
        options={{ ...registryItem!.transformation.defaultOptions, ...transformConfig.options }}
      />
      {showNoOptions && <NoOptionsIndicator name={registryItem?.name ?? ''} />}
    </div>
  );
}
