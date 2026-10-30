import { type DataTransformerConfig } from '@grafana/data';
import { t } from '@grafana/i18n';
import { validateTransformationRefId } from 'app/features/dashboard/components/TransformationsEditor/transformationRefId';

import { type Transformation } from '../types';

import { EditableName } from './EditableName';

interface EditableTransformationNameProps {
  transformation: Transformation;
  transformations: Transformation[];
  /** The name the output frame gets when none is pinned. Undefined when there is no single output. */
  dynamicRefId?: string;
  /** refIds already in the input. Reusing one would make a downstream byRefId filter select both frames. */
  reservedRefIds?: string[];
  onUpdate: (oldConfig: DataTransformerConfig, newConfig: DataTransformerConfig) => void;
}

export function EditableTransformationName({
  transformation,
  transformations,
  dynamicRefId,
  reservedRefIds,
  onUpdate,
}: EditableTransformationNameProps) {
  const config = transformation.transformConfig;

  const validate = (name: string): string | null =>
    validateTransformationRefId(name, {
      transformation: config,
      transformations: transformations.map(({ transformConfig }) => transformConfig),
      reservedRefIds,
    });

  const onCommit = (name: string) => {
    // Cleared back to the generated name rather than saved as an empty string, which the schema
    // permits but every transformer treats as unset.
    onUpdate(config, { ...config, refId: name === '' ? undefined : name });
  };

  return (
    <EditableName
      value={config.refId ?? ''}
      placeholder={dynamicRefId ?? t('query-editor-next.transformation-name.auto-placeholder', '(Auto)')}
      validate={validate}
      onCommit={onCommit}
      label={t('query-editor-next.transformation-name.edit', 'Edit transformation name')}
      data-testid="transformation-refid-div"
      inputTestId="transformation-refid-input"
    />
  );
}
