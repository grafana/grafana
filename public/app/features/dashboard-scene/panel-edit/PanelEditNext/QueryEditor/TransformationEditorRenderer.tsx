import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { TransformationDebugDisplay } from './TransformationDebugDisplay';
import { TransformationEditor } from './TransformationEditor';
import { TransformationFilterDisplay } from './TransformationFilterDisplay';
import { TransformationHelpDisplay } from './TransformationHelpDisplay';
import { useTransformationInputData } from './hooks/useTransformationInputData';

export function TransformationEditorRenderer() {
  const { data } = useQueryRunnerContext();
  const { highlightedTransformation } = useQueryEditorUIContext();
  const { transformations } = usePanelContext();
  const { updateTransformation } = useActionsContext();

  const rawData = useMemo(() => data?.series ?? [], [data]);

  const inputData = useTransformationInputData({
    selectedTransformation: highlightedTransformation,
    allTransformations: transformations,
    rawData,
  });

  if (!highlightedTransformation) {
    return null;
  }

  if (!highlightedTransformation.registryItem?.editor) {
    return (
      <Alert
        severity="error"
        title={t(
          'transformation-editor-renderer.no-transformation-editor-title',
          'Transformation does not have an editor component'
        )}
      />
    );
  }

  return (
    <>
      <TransformationFilterDisplay />
      <TransformationEditor
        key={highlightedTransformation.transformId}
        inputData={inputData}
        onUpdate={updateTransformation}
        transformation={highlightedTransformation}
      />
      <TransformationHelpDisplay />
      <TransformationDebugDisplay />
    </>
  );
}
