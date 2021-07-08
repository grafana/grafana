// import { map } from 'rxjs/operators';
// import { DataFrame, DataTransformerID, DataTransformerInfo, MatcherConfig, ReducerID } from '@grafana/data';

// export interface ConfigFromDataTransformerOptions {
//   sources: ConfigFromDataTransformerOptionsSourceDef[];
//   applyTo: MatcherConfig;
//   keepSources?: boolean;
// }

// export interface ConfigFromDataTransformerOptionsSourceDef {
//   /** Field name to use as config source */
//   fieldName: string;
//   /** If field has multiple values which value to use */
//   reducerId: ReducerID;
//   /** Config property to set */
//   configProperty: string;
// }

// export const configFromDataTransformer: DataTransformerInfo<ConfigFromDataTransformerOptions> = {
//   id: DataTransformerID.configFromData,
//   name: 'Config from data',
//   description: 'Set unit, min, max and more from data',
//   defaultOptions: {},

//   /**
//    * Return a modified copy of the series.  If the transform is not or should not
//    * be applied, just return the input series
//    */
//   operator: (options) => (source) => source.pipe(map((data) => extractConfigFromData(options, data))),
// };

// export function extractConfigFromData(options: ConfigFromDataTransformerOptions, data: DataFrame[]) {
//   return data;
// }
