import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';
import { TransformationDebugDisplay } from './TransformationDebugDisplay';
import { TransformationEditor } from './TransformationEditor';
import { TransformationFilterDisplay } from './TransformationFilterDisplay';
import { TransformationHelpDisplay } from './TransformationHelpDisplay';

export function TransformationEditorRenderer() {
  const { data } = useQueryRunnerContext();
  const { selectedTransformation } = useQueryEditorUIContext();
  const { updateTransformation } = useActionsContext();

  // Memoize to avoid recreating potentially large data.series array reference on every render.
  // This prevents unnecessary re-renders and processing in TransformationEditor.
  const inputData = useMemo(() => data?.series ?? [], [data?.series]);

  if (!selectedTransformation) {
    return null;
  }

  if (!selectedTransformation.registryItem?.editor) {
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
        inputData={inputData}
        onUpdate={updateTransformation}
        transformation={selectedTransformation}
      />
      <TransformationHelpDisplay />
      <TransformationDebugDisplay />
    </>
  );
}
