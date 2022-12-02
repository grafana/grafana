import { map } from 'rxjs/operators';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  FieldType,
  SynchronousDataTransformerInfo,
  VariableWithOptions,
} from '@grafana/data';
import { getFieldDisplayName } from '@grafana/data/src/field/fieldState';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

export interface RenameByMappingTransformOptions {
  varName: string | undefined;
}

export const renameByMappingTransformer: SynchronousDataTransformerInfo<RenameByMappingTransformOptions> = {
  id: DataTransformerID.renameByMapping,
  name: 'Rename by Mapping',
  description: 'Rename fields using a text-value mapping',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => renameByMappingTransformer.transformer(options)(data))),

  transformer: (options: RenameByMappingTransformOptions) => {
    return (data: DataFrame[]) => {
      if (!data || !data.length) {
        return data;
      }
      return renameByMapping(options, data);
    };
  },
};

type VarMap = {
  [key: string]: string;
};

export function getVariablesList() {
  const templateSrv: TemplateSrv = getTemplateSrv();
  const currentVars = templateSrv.getVariables();
  const varsList = currentVars.map((x) => ({ label: x.label || x.name, value: x.id }));
  return varsList;
}

function getVariableWithIndex(index: string) {
  const templateSrv: TemplateSrv = getTemplateSrv();
  const currentVars = templateSrv.getVariables();
  return currentVars.find((variable) => variable.id === index);
}

function convertVariableToMapping(varName: string): VarMap {
  const mapping: VarMap = {};
  const thisvar: VariableWithOptions | undefined = getVariableWithIndex(varName);
  const varopts = thisvar?.options;
  varopts?.map((i) => (mapping[String(i.value)] = String(i.text)));
  return mapping;
}

export function renameByMapping(options: RenameByMappingTransformOptions, data: DataFrame[]): DataFrame[] {
  if (!options.varName) {
    return [getErrorFrame('No variable selected')];
  }
  const distinctVars = getVariablesList();
  if (distinctVars.length < 1) {
    return [getErrorFrame('No variables in current dashboard')];
  }
  if (!distinctVars.map((x) => x.value).includes(options.varName)) {
    return [getErrorFrame('Variable "' + options.varName + '" not found')];
  }
  let mapping;
  try {
    mapping = convertVariableToMapping(options.varName);
  } catch (e) {
    return [getErrorFrame('Variable "' + options.varName + '" is not text-value mapping')];
  }
  return data.map(renameFrameByMapping(options, mapping));
}

export const renameFrameByMapping =
  (options: RenameByMappingTransformOptions, mapping: VarMap) => (frame: DataFrame) => {
    const fields = frame.fields.map((field) => {
      const displayName = getFieldDisplayName(field, frame);
      // replace any matching tokens with values from the mapping
      // tokenize and preserve whitespace by splitting on word-boundaries adjacent to spaces
      const tokenRegex = /(?<=\s)\b|\b(?=\s)/;
      const newDisplayName = displayName
        ?.split(tokenRegex)
        .map((x) => mapping[x] || x)
        .join('');
      if (!newDisplayName) {
        return field;
      }
      return {
        ...field,
        config: { ...field.config, displayName: newDisplayName },
        state: { ...field.state, displayName: newDisplayName },
      };
    });
    return { ...frame, fields };
  };

function getErrorFrame(text: string): DataFrame {
  return {
    meta: {
      notices: [{ severity: 'error', text }],
    },
    fields: [{ name: 'Error', type: FieldType.string, config: {}, values: new ArrayVector([text]) }],
    length: 0,
  };
}
