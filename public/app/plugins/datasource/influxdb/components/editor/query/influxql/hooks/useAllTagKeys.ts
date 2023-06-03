import { useMemo } from 'react';

import InfluxDatasource from '../../../../../datasource';
import { runMetadataQuery } from '../../../../../influxql_metadata_migrated';

export const useAllTagKeys = (datasource: InfluxDatasource, retentionPolicy?: string, measurement?: string) => {
  const allTagKeys = useMemo(async () => {
    const tagKeysData = await runMetadataQuery({ type: 'TAG_KEYS', datasource, measurement, retentionPolicy });
    const tagKeys = tagKeysData.map((item) => `${item.text}::tag`);

    const fieldKeysData = await runMetadataQuery({ type: 'FIELDS', datasource, measurement, retentionPolicy });
    const fieldKeys = fieldKeysData.map((item) => `${item.text}::field`);

    return new Set([...tagKeys, ...fieldKeys]);
  }, [measurement, retentionPolicy, datasource]);

  return { allTagKeys };
};
