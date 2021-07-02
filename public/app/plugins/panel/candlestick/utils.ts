import { DataFrame, Field, FieldType, getFieldDisplayName } from '@grafana/data';
import { SemanticFieldsMappings } from '../../../../../packages/grafana-ui/src';
import { SemanticFieldsMapper, semanticFields } from './types';

// this will set field.state.semanticType for any mapped known fields
export function tagSemanticFields(frames: DataFrame[], mappings: SemanticFieldsMappings): void {
  const mapper = getSemanticFieldMapper(mappings ?? {});

  for (let frame of frames) {
    for (const field of frame.fields) {
      field.state!.semanticType = field.type === FieldType.time ? 'time' : mapper(field, frame);
    }
  }
}

// Get a field mapper from the configuraiton
export function getSemanticFieldMapper(mappings: SemanticFieldsMappings): SemanticFieldsMapper {
  const mappers = semanticFields.map((f) => {
    const name = mappings[f] ?? f;
    return (fname: string, disp: string) => {
      if (name === fname || disp === name) {
        return f;
      }
      return undefined;
    };
  });

  return (field: Field, frame: DataFrame) => {
    for (const mapper of mappers) {
      const disp = getFieldDisplayName(field, frame);
      const v = mapper(field.name, disp);
      if (v) {
        return v;
      }
    }
    return undefined;
  };
}
