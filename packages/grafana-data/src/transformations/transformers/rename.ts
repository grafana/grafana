import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

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
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const renamer = createRenamer(options.renameByName);

        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map((frame) => ({
          ...frame,
          fields: renamer(frame),
        }));
      })
    ),
};

const createRenamer =
  (renameByName: Record<string, string>) =>
  (frame: DataFrame): Field[] => {
    if (!renameByName || Object.keys(renameByName).length === 0) {
      return frame.fields;
    }

    return frame.fields.map((field) => {
      const displayName = getFieldDisplayName(field, frame);
      const renameTo = renameByName[displayName];

      if (typeof renameTo !== 'string' || renameTo.length === 0) {
        return field;
      }

      return {
        ...field,
        config: {
          ...field.config,
          displayName: renameTo,
        },
        state: {
          ...field.state,
          displayName: renameTo,
        },
      };
    });
  };
