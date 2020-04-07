import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame, Field } from '../..';

export interface RenameFieldsTransformerOptions {
  renameByName: Record<string, string>;
}

export const renameFieldsTransformer: DataTransformerInfo<RenameFieldsTransformerOptions> = {
  id: DataTransformerID.rename,
  name: 'Rename fields by name',
  description: 'Rename fields based on configuration given by user',
  defaultOptions: {
    renameByName: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: RenameFieldsTransformerOptions) => {
    const renamer = createRenamer(options.renameByName);

    return (data: DataFrame[]) => {
      if (!Array.isArray(data) || data.length === 0) {
        return data;
      }

      return data.map(frame => ({
        ...frame,
        fields: renamer(frame.fields),
      }));
    };
  },
};

const createRenamer = (renameByName: Record<string, string>) => (fields: Field[]): Field[] => {
  if (!renameByName || Object.keys(renameByName).length === 0) {
    return fields;
  }

  return fields.map(field => {
    const renameTo = renameByName[field.name];

    if (typeof renameTo !== 'string' || renameTo.length === 0) {
      return field;
    }

    return {
      ...field,
      name: renameTo,
    };
  });
};
