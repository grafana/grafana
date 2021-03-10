import { InfluxQueryTag } from './types';
import InfluxDatasource from './datasource';
import { InfluxQueryBuilder } from './query_builder';

class InvalidMetadataError extends Error {
  constructor(obj: unknown) {
    console.error('invalid data', obj);
    super('invalid data');
  }
}

// to make sure the data returned from the server is the correct form.
// TODO: remove this when we are finished (probably)
function assertMetadataResponse(data: unknown): Array<{ text: string }> {
  if (!Array.isArray(data)) {
    throw new InvalidMetadataError(data);
  }

  return data.map((item) => {
    if (item == null || typeof item !== 'object') {
      throw new InvalidMetadataError(data);
    }

    const { text } = item;
    if (typeof text !== 'string') {
      throw new InvalidMetadataError(data);
    }
    return item;
  });
}

const runExploreQuery = async (
  type: string,
  withKey: string | undefined,
  target: { measurement: string | undefined; tags: InfluxQueryTag[]; policy: string | undefined },
  datasource: InfluxDatasource
): Promise<Array<{ text: string }>> => {
  const builder = new InfluxQueryBuilder(target, datasource.database);
  const q = builder.buildExploreQuery(type, withKey);
  return assertMetadataResponse(await datasource.metricFindQuery(q));
};

export async function getAllPolicies(datasource: InfluxDatasource): Promise<string[]> {
  const target = { tags: [], measurement: undefined, policy: undefined };
  const data = await runExploreQuery('RETENTION POLICIES', undefined, target, datasource);
  return data.map((item) => item.text);
}

export async function getAllMeasurements(datasource: InfluxDatasource): Promise<string[]> {
  const target = { tags: [], measurement: undefined, policy: undefined };
  const data = await runExploreQuery('MEASUREMENTS', undefined, target, datasource);
  return data.map((item) => item.text);
}

export async function getTagKeysForMeasurementAndTags(
  measurement: string,
  policy: string | undefined,
  tags: InfluxQueryTag[],
  datasource: InfluxDatasource
): Promise<string[]> {
  const target = { tags, measurement, policy };
  const data = await runExploreQuery('TAG_KEYS', undefined, target, datasource);
  return data.map((item) => item.text);
}

export async function getTagValues(
  tagKey: string,
  measurement: string,
  policy: string | undefined,
  datasource: InfluxDatasource
): Promise<string[]> {
  const target = { tags: [], measurement, policy };
  const data = await runExploreQuery('TAG_VALUES', tagKey, target, datasource);
  return data.map((item) => item.text);
}

export async function getFieldKeysForMeasurement(
  measurement: string,
  policy: string | undefined,
  datasource: InfluxDatasource
): Promise<string[]> {
  const target = { tags: [], measurement, policy };
  const data = await runExploreQuery('FIELDS', undefined, target, datasource);
  return data.map((item) => item.text);
}
