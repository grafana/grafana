import { useMemo } from 'react';

import { type DataTransformerConfig, type PanelData, transformerUsesDynamicRefId } from '@grafana/data';

import { usePreviousTransformationOutput } from '../hooks/usePreviousTransformationOutput';
import { useTransformationGeneratedRefId } from '../hooks/useTransformationGeneratedRefId';
import { type Transformation } from '../types';

import { EditableTransformationName } from './EditableTransformationName';

interface TransformationIdentifierProps {
  transformation: Transformation;
  transformations: Transformation[];
  data?: PanelData;
  /** Shown when this transformation produces no frame of its own to name. */
  fallbackName: string;
  onUpdate: (oldConfig: DataTransformerConfig, newConfig: DataTransformerConfig) => void;
}

/** Stable identity for "no query data yet", so it does not re-run the replays below. */
const NO_SERIES: PanelData['series'] = [];

/**
 * The transformation's name in a header: editable for the transformations that produce a frame of
 * their own, plain text for the rest.
 */
export function TransformationIdentifier({
  transformation,
  transformations,
  data,
  fallbackName,
  onUpdate,
}: TransformationIdentifierProps) {
  // Follows the configuration rather than the data, so the editor does not appear and disappear as
  // queries come and go.
  const canSetRefId = transformation.registryItem
    ? transformerUsesDynamicRefId(transformation.registryItem, transformation.transformConfig.options)
    : false;

  if (!canSetRefId) {
    return <>{fallbackName}</>;
  }

  return (
    <EditableIdentifier
      transformation={transformation}
      transformations={transformations}
      data={data}
      onUpdate={onUpdate}
    />
  );
}

/**
 * Split out so the replays below only run for the transformations that can use them. The stacked
 * editor mounts one identifier per transformation and hooks cannot sit behind a condition, so
 * inlining this would replay every preceding transformation for rows that render plain text.
 */
function EditableIdentifier({
  transformation,
  transformations,
  data,
  onUpdate,
}: Omit<TransformationIdentifierProps, 'fallbackName'>) {
  const rawData = data?.series ?? NO_SERIES;

  const dynamicRefId = useTransformationGeneratedRefId({ transformation, transformations, rawData });

  const previousOutput = usePreviousTransformationOutput({
    selectedTransformation: transformation,
    transformations,
    queryData: rawData,
    queryTargets: data?.request?.targets,
  });

  const reservedRefIds = useMemo(
    () => previousOutput.map(({ refId }) => refId).filter((refId): refId is string => !!refId),
    [previousOutput]
  );

  return (
    <EditableTransformationName
      transformation={transformation}
      transformations={transformations}
      dynamicRefId={dynamicRefId}
      reservedRefIds={reservedRefIds}
      onUpdate={onUpdate}
    />
  );
}
