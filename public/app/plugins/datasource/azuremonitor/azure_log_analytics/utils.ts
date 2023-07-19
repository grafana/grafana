import { VariableModel } from '@grafana/data';

import { AzureLogAnalyticsMetadata } from '../types/logAnalyticsMetadata';

// matches (name):(type) = (defaultValue)
// e.g. fromRangeStart:datetime = datetime(null)
//  - name: fromRangeStart
//  - type: datetime
//  - defaultValue: datetime(null)
const METADATA_FUNCTION_PARAMS = /([\w\W]+):([\w]+)(?:\s?=\s?([\w\W]+))?/;

function transformMetadataFunction(sourceSchema: AzureLogAnalyticsMetadata) {
  if (!sourceSchema.functions) {
    return [];
  }

  return sourceSchema.functions.map((fn) => {
    const params =
      fn.parameters &&
      fn.parameters
        .split(', ')
        .map((arg) => {
          const match = arg.match(METADATA_FUNCTION_PARAMS);
          if (!match) {
            return;
          }

          const [, name, type, defaultValue] = match;

          return {
            name,
            type,
            defaultValue,
            cslDefaultValue: defaultValue,
          };
        })
        .filter(<T>(v: T): v is Exclude<T, undefined> => !!v);

    return {
      name: fn.name,
      body: fn.body,
      inputParameters: params || [],
    };
  });
}

export function transformMetadataToKustoSchema(
  sourceSchema: AzureLogAnalyticsMetadata,
  nameOrIdOrSomething: string,
  templateVariables: VariableModel[]
) {
  const database = {
    name: nameOrIdOrSomething,
    tables: sourceSchema.tables,
    functions: transformMetadataFunction(sourceSchema),
    majorVersion: 0,
    minorVersion: 0,
  };

  // Adding macros as known functions
  database.functions.push(
    {
      name: '$__timeFilter',
      body: '{ true }',
      inputParameters: [
        {
          name: 'timeColumn',
          type: 'System.String',
          defaultValue: '""',
          cslDefaultValue: '""',
        },
      ],
    },
    {
      name: '$__timeFrom',
      body: '{ datetime(2018-06-05T18:09:58.907Z) }',
      inputParameters: [],
    },
    {
      name: '$__timeTo',
      body: '{ datetime(2018-06-05T20:09:58.907Z) }',
      inputParameters: [],
    },
    {
      name: '$__escapeMulti',
      body: `{ @'\\grafana-vm\Network(eth0)\Total', @'\\hello!'}`,
      inputParameters: [
        {
          name: '$myVar',
          type: 'System.String',
          defaultValue: '$myVar',
          cslDefaultValue: '$myVar',
        },
      ],
    },
    {
      name: '$__contains',
      body: `{ colName in ('value1','value2') }`,
      inputParameters: [
        {
          name: 'colName',
          type: 'System.String',
          defaultValue: 'colName',
          cslDefaultValue: 'colName',
        },
        {
          name: '$myVar',
          type: 'System.String',
          defaultValue: '$myVar',
          cslDefaultValue: '$myVar',
        },
      ],
    }
  );

  // Adding macros as global parameters
  const globalParameters = templateVariables.map((v) => {
    return {
      name: `$${v.name}`,
      type: 'dynamic',
    };
  });

  return {
    clusterType: 'Engine',
    cluster: {
      connectionString: nameOrIdOrSomething,
      databases: [database],
    },
    database: database,
    globalParameters,
  };
}
