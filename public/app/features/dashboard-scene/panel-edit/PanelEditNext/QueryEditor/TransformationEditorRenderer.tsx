import { useMemo } from 'react';

import { type DataTransformerConfig, type PanelData } from '@grafana/data';
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
import { TransformationFilterEditor } from './TransformationFilterDisplay';
import { TransformationHelpDisplay } from './TransformationHelpDisplay';
import { useTransformationInputData } from './hooks/useTransformationInputData';
import { type Transformation } from './types';

interface TransformationEditorPanelProps {
  transformation: Transformation | null;
  transformations: Transformation[];
  data?: PanelData;
  updateTransformation: (oldConfig: DataTransformerConfig, newConfig: DataTransformerConfig) => void;
  showSupplementalDisplays?: boolean;
}

export function TransformationEditorPanel({
  transformation,
  transformations,
  data,
  updateTransformation,
  showSupplementalDisplays = false,
}: TransformationEditorPanelProps) {
  const rawData = useMemo(() => data?.series ?? [], [data]);

  const inputData = useTransformationInputData({
    selectedTransformation: transformation,
    allTransformations: transformations,
    rawData,
  });

  if (!transformation) {
    return null;
  }

  if (!transformation.registryItem?.editor) {
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
      <TransformationFilterEditor
        transformation={transformation}
        transformations={transformations}
        queryData={data}
        onUpdate={updateTransformation}
      />
      <TransformationEditor
        key={transformation.transformId}
        inputData={inputData}
        onUpdate={updateTransformation}
        transformation={transformation}
      />
      {showSupplementalDisplays && <TransformationHelpDisplay />}
      {showSupplementalDisplays && <TransformationDebugDisplay />}
    </>
  );
}

export function TransformationEditorRenderer() {
  const { data } = useQueryRunnerContext();
  const { selectedTransformation } = useQueryEditorUIContext();
  const { transformations } = usePanelContext();
  const { updateTransformation } = useActionsContext();

  return (
    <TransformationEditorPanel
      transformation={selectedTransformation}
      transformations={transformations}
      data={data}
      updateTransformation={updateTransformation}
      showSupplementalDisplays
    />
  );
}
