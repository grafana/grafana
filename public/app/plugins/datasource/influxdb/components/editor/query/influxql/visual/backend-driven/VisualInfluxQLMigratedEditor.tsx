import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { InlineLabel, SegmentSection, useStyles2 } from '@grafana/ui/src';

import InfluxDatasource from '../../../../../../datasource';
import { InfluxQuery, InfluxQueryTag } from '../../../../../../types';
import { useAllMeasurementsForTags } from '../../hooks/useAllMeasurementsForTags';
import { useAllTagKeys } from '../../hooks/useAllTagKeys';
import { useRetentionPolicies } from '../../hooks/useRetentionPolicies';
import { useTagKeys } from '../../hooks/useTagKeys';
import { useTagValues } from '../../hooks/useTagValues';
import { filterTags } from '../../utils/filterTags';
import { withTemplateVariableOptions } from '../../utils/withTemplateVariableOptions';
import { wrapPure, wrapRegex } from '../../utils/wrapper';
import { FromSection } from '../shared/FromSection';
import { TagsSection } from '../shared/TagsSection';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

export const VisualInfluxQLMigratedEditor = ({ datasource, query, onRunQuery, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const { retentionPolicies } = useRetentionPolicies(datasource);
  const { allTagKeys } = useAllTagKeys(datasource, query.policy, query.measurement);
  const { getTagKeys } = useTagKeys(allTagKeys, query.tags);
  const { getAllMeasurementsForTags } = useAllMeasurementsForTags(datasource);
  const { getTagValues } = useTagValues(datasource, query);

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

  const handleTagsSectionChange = (tags: InfluxQueryTag[]) => {
    // we set empty-arrays to undefined
    onAppliedChange({
      ...query,
      tags: tags.length === 0 ? undefined : tags,
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
        <InlineLabel width="auto" className={styles.inlineLabel}>
          WHERE
        </InlineLabel>
        <TagsSection
          tags={query.tags ?? []}
          onChange={handleTagsSectionChange}
          getTagKeyOptions={getTagKeys}
          getTagValueOptions={(key) =>
            withTemplateVariableOptions(
              allTagKeys.then((keys) =>
                getTagValues(key, filterTags(query.tags ?? [], keys) /*, query.measurement, query.policy*/)
              ),
              wrapRegex
            )
          }
        />
      </SegmentSection>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    inlineLabel: css`
      color: ${theme.colors.primary.text};
    `,
  };
}
