import InfluxDatasource from '../../../../../datasource';
import { runMetadataQuery } from '../../../../../influxql_metadata_migrated';
import { InfluxQuery, InfluxQueryTag } from '../../../../../types';

export const useTagValues = (datasource: InfluxDatasource, query: InfluxQuery) => {
  const getTagValues = async (tagKey: string, tags: InfluxQueryTag[]) => {
    if (tagKey.endsWith('::field')) {
      return [];
    }
    const data = await runMetadataQuery({
      type: 'TAG_VALUES',
      datasource,
      tags,
      withKey: tagKey,
      measurement: query.measurement,
      retentionPolicy: query.policy,
    });
    return data.map((item) => item.text);
  };
  return { getTagValues };
};
