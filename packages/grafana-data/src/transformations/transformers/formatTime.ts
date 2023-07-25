import { map } from 'rxjs/operators';

import { dateTime } from '../../datetime';

// import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field } from '../../types/dataFrame';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface FormatTimeTransformerOptions {
  // renameByName: Record<string, string>;
  timeField: string;
  outputFormat: string;
}

export const formatTimeTransformer: DataTransformerInfo<FormatTimeTransformerOptions> = {
  id: DataTransformerID.formatTime,
  name: 'Format Time',
  description: 'Set the output format of a time field',
  defaultOptions: {timeField: '', outputFormat: ''},

  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        // const newFrames: Array<DataFrame> = [];

        // If a field and a format are configured
        // then format the time output

        // const formatter = () => createFormatter({test: 'test'});

        // console.log()


        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        const newData = data.map((frame) => {

          const newFields = frame.fields.map((field) => {
            // Find the configured field
            if (field.name === options.timeField) {

              // Update values to use the configured format
              const newVals = field.values.map((value) => {
                const moment = dateTime(value)
                return moment.format(options.outputFormat)
              })

              return {
                ...field,
                values: newVals
              }
            }


            return field;
          });

         
         

          return {...frame, fields: newFields}
        });

        console.log(newData);
        

        return newData;
      })
    ),
};

