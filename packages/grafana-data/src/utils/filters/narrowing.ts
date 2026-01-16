import { LokiLabelType } from '../../types/templateVars';

export function narrowLokiLabelTypes(input: unknown): LokiLabelType | null {
  if (input === 'Indexed' || input === 'I') {
    return LokiLabelType.Indexed;
  } else if (input === 'StructuredMetadata' || input === 'S') {
    return LokiLabelType.StructuredMetadata;
  } else if (input === 'Parsed' || input === 'P') {
    return LokiLabelType.Parsed;
  }

  return null;
}
