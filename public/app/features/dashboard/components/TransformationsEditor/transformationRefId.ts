import { type DataTransformerConfig } from '@grafana/data';
import { t } from '@grafana/i18n';
import { variableRegexExec } from 'app/features/variables/utils';

interface ValidateOptions {
  /** The transformation being renamed, excluded from the duplicate check. */
  transformation: DataTransformerConfig;
  /** Every transformation on the panel, including the one being renamed. */
  transformations: DataTransformerConfig[];
  /** refIds already in the input. Reusing one would make a downstream byRefId filter select both frames. */
  reservedRefIds?: string[];
}

/**
 * Shared by both panel editors, so a name one accepts is not rejected by the other.
 *
 * Blank is valid and means "unset" — the caller decides whether that clears an existing name.
 */
export function validateTransformationRefId(
  refId: string,
  { transformation, transformations, reservedRefIds = [] }: ValidateOptions
): string | null {
  if (refId === '') {
    return null;
  }

  // A variable would make the refId move with its value, the instability this field prevents.
  if (variableRegexExec(refId) !== null) {
    return t(
      'dashboard.transformation-operation-row.transformation-editor-row-header.refId-variable-error',
      'Transformation name cannot contain a variable'
    );
  }

  if (transformations.some((other) => other !== transformation && other.refId === refId)) {
    return t(
      'dashboard.transformation-operation-row.transformation-editor-row-header.refId-exists-error',
      'Transformation name already exists'
    );
  }

  if (reservedRefIds.includes(refId)) {
    return t(
      'dashboard.transformation-operation-row.transformation-editor-row-header.refId-reserved-error',
      'Transformation name is already used by a query or an earlier transformation'
    );
  }

  return null;
}
