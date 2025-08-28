import { map } from 'rxjs/operators';

import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface IgnoreRowTransformerOptions {
    position: 'first' | 'last';
}

export const ignoreRowTransformer: DataTransformerInfo<IgnoreRowTransformerOptions> = {
    id: DataTransformerID.ignoreRow,
    name: 'Ignore Row',
    description: 'Ignore the first or last row of each series',
    defaultOptions: {
        position: 'first',
    },

    operator: (options) => (source) =>
        source.pipe(
            map((data) => {
                return data.map((frame) => {
                    if (frame.length <= 1) {
                        // If frame has 1 or 0 rows, return empty frame
                        return {
                            ...frame,
                            fields: frame.fields.map((field) => ({
                                ...field,
                                values: [],
                            })),
                            length: 0,
                        };
                    }

                    let startIndex = 0;
                    let endIndex = frame.length;

                    if (options.position === 'first') {
                        // Skip first row
                        startIndex = 1;
                    } else if (options.position === 'last') {
                        // Skip last row
                        endIndex = frame.length - 1;
                    }

                    return {
                        ...frame,
                        fields: frame.fields.map((field) => ({
                            ...field,
                            values: field.values.slice(startIndex, endIndex),
                        })),
                        length: endIndex - startIndex,
                    };
                });
            })
        ),
};
