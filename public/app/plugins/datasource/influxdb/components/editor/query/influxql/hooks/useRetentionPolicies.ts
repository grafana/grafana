import { useEffect, useState } from 'react';

import InfluxDatasource from '../../../../../datasource';
import { runMetadataQuery } from '../../../../../influxql_metadata_migrated';

export const useRetentionPolicies = (datasource: InfluxDatasource) => {
  const [retentionPolicies, setRetentionPolicies] = useState<string[]>([]);
  useEffect(() => {
    runMetadataQuery({ type: 'RETENTION_POLICIES', datasource }).then((data) => {
      const rps = data.map((item) => item.text);
      setRetentionPolicies(rps);
    });
  }, [datasource]);

  return { retentionPolicies };
};
