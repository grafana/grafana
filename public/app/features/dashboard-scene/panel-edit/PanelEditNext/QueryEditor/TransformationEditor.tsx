import { Suspense, useCallback } from 'react';

import { DataTransformerID, type DataTransformerConfig, type DataFrame } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { ErrorBoundaryAlert, LoadingPlaceholder } from '@grafana/ui';

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
      <ErrorBoundaryAlert>
        <Suspense
          fallback={<LoadingPlaceholder text={t('transformers.transformation-editor.loading', 'Loading editor...')} />}
        >
          <Editor
            input={inputData}
            onChange={handleChange}
            options={{ ...registryItem!.defaultOptions, ...transformConfig.options }}
          />
        </Suspense>
      </ErrorBoundaryAlert>
      {showNoOptions && <NoOptionsIndicator name={registryItem?.name ?? ''} />}
    </div>
  );
}
