import { useState } from 'react';

import InfluxDatasource from '../../../../../datasource';
import { runMetadataQuery } from '../../../../../influxql_metadata_migrated';
import { InfluxQueryTag } from '../../../../../types';

export const useAllMeasurementsForTags = (datasource: InfluxDatasource) => {
  const [allMeasurements, setAllMeasurements] = useState<string[]>([]);
  const getAllMeasurementsForTags = async (
    tags: InfluxQueryTag[],
    withMeasurementFilter?: string
  ): Promise<string[]> => {
    const data = await runMetadataQuery({ type: 'MEASUREMENTS', datasource, tags, withMeasurementFilter });
    const all = data.map((item) => item.text);
    setAllMeasurements(all);
    return all;
  };
  return { allMeasurements, getAllMeasurementsForTags };
};
