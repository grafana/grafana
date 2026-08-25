import { useMemo } from 'react';

import { type DataTransformerConfig, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, ErrorBoundaryAlert } from '@grafana/ui';

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

  // Each display is bounded on its own. All three replay the pipeline to describe it — over frames
  // and options a dashboard supplies, through registry lookups that throw on what they do not
  // recognise — and `TransformationEditor` already bounds the plugin editor it renders for the same
  // reason. Without these, a throw in any one of them takes the whole editor down with it rather
  // than the part that could not render.
  return (
    <>
      <ErrorBoundaryAlert boundaryName="transformation-filter">
        <TransformationFilterEditor
          transformation={transformation}
          transformations={transformations}
          queryData={data}
          onUpdate={updateTransformation}
        />
      </ErrorBoundaryAlert>
      <TransformationEditor
        key={transformation.transformId}
        inputData={inputData}
        onUpdate={updateTransformation}
        transformation={transformation}
      />
      {showSupplementalDisplays && (
        <ErrorBoundaryAlert boundaryName="transformation-help">
          <TransformationHelpDisplay />
        </ErrorBoundaryAlert>
      )}
      {showSupplementalDisplays && (
        <ErrorBoundaryAlert boundaryName="transformation-debug">
          <TransformationDebugDisplay />
        </ErrorBoundaryAlert>
      )}
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
