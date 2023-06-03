import React from 'react';

import { SegmentSection } from '@grafana/ui/src';

import InfluxDatasource from '../../../../../../datasource';
import { InfluxQuery } from '../../../../../../types';
import { useAllMeasurementsForTags } from '../../hooks/useAllMeasurementsForTags';
import { useAllTagKeys } from '../../hooks/useAllTagKeys';
import { useRetentionPolicies } from '../../hooks/useRetentionPolicies';
import { filterTags } from '../../utils/filterTags';
import { withTemplateVariableOptions } from '../../utils/withTemplateVariableOptions';
import { wrapPure, wrapRegex } from '../../utils/wrapper';
import { FromSection } from '../shared/FromSection';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const VisualInfluxQLMigratedEditor = ({ datasource, query, onRunQuery, onChange }: Props) => {
  const { retentionPolicies } = useRetentionPolicies(datasource);
  const { allTagKeys } = useAllTagKeys(datasource, query.policy, query.measurement);
  const { getAllMeasurementsForTags } = useAllMeasurementsForTags(datasource);

  const onAppliedChange = (newQuery: InfluxQuery) => {
    onChange(newQuery);
    onRunQuery();
  };
  const handleFromSectionChange = (policy?: string, measurement?: string) => {
    onAppliedChange({
      ...query,
      policy,
      measurement,
    });
  };

  return (
    <div>
      <SegmentSection label="FROM" fill={true}>
        <FromSection
          policy={query.policy ?? retentionPolicies[0]}
          measurement={query.measurement}
          getPolicyOptions={() => withTemplateVariableOptions(Promise.resolve(retentionPolicies), wrapPure)}
          getMeasurementOptions={(filter) =>
            withTemplateVariableOptions(
              allTagKeys.then((keys) =>
                getAllMeasurementsForTags(filterTags(query.tags ?? [], keys), filter === '' ? undefined : filter)
              ),
              wrapRegex,
              filter
            )
          }
          onChange={handleFromSectionChange}
        />
        {/*<InlineLabel width="auto" className={styles.inlineLabel}>*/}
        {/*  WHERE*/}
        {/*</InlineLabel>*/}
        {/*<TagsSection*/}
        {/*  tags={query.tags ?? []}*/}
        {/*  onChange={handleTagsSectionChange}*/}
        {/*  getTagKeyOptions={getTagKeys}*/}
        {/*  getTagValueOptions={(key: string) =>*/}
        {/*    withTemplateVariableOptions(*/}
        {/*      allTagKeys.then((keys) =>*/}
        {/*        getTagValues(key, measurement, policy, filterTags(query.tags ?? [], keys), datasource)*/}
        {/*      ),*/}
        {/*      wrapRegex*/}
        {/*    )*/}
        {/*  }*/}
        {/*/>*/}
      </SegmentSection>
    </div>
  );
};
