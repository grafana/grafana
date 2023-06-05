import { useEffect, useState } from 'react';

import InfluxDatasource from '../../../../../datasource';
import { getAllPolicies } from '../../../../../influxql_metadata_query';

export const useRetentionPolicies = (datasource: InfluxDatasource) => {
  const [retentionPolicies, setRetentionPolicies] = useState<string[]>([]);
  useEffect(() => {
    getAllPolicies(datasource).then((data) => {
      setRetentionPolicies(data);
    });
  }, [datasource]);

  return { retentionPolicies };
};
