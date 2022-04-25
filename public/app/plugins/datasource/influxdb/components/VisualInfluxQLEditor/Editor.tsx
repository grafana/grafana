import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineLabel, SegmentSection, useStyles2 } from '@grafana/ui';

import InfluxDatasource from '../../datasource';
import {
  getAllMeasurementsForTags,
  getAllPolicies,
  getFieldKeysForMeasurement,
  getTagKeysForMeasurementAndTags,
  getTagValues,
} from '../../influxQLMetadataQuery';
import {
  normalizeQuery,
  addNewSelectPart,
  removeSelectPart,
  addNewGroupByPart,
  removeGroupByPart,
  changeSelectPart,
  changeGroupByPart,
} from '../../queryUtils';
import { InfluxQuery, InfluxQueryTag } from '../../types';
import { DEFAULT_RESULT_FORMAT } from '../constants';
import { useUniqueId } from '../useUniqueId';

import { FormatAsSection } from './FormatAsSection';
import { FromSection } from './FromSection';
import { InputSection } from './InputSection';
import { OrderByTimeSection } from './OrderByTimeSection';
import { PartListSection } from './PartListSection';
import { TagsSection } from './TagsSection';
import { getNewSelectPartOptions, getNewGroupByPartOptions, makePartList } from './partListUtils';

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

function getTemplateVariableOptions() {
  return (
    getTemplateSrv()
      .getVariables()
      // we make them regex-params, i'm not 100% sure why.
      // probably because this way multi-value variables work ok too.
      .map((v) => `/^$${v.name}$/`)
  );
}

// helper function to make it easy to call this from the widget-render-code
function withTemplateVariableOptions(optionsPromise: Promise<string[]>): Promise<string[]> {
  return optionsPromise.then((options) => [...getTemplateVariableOptions(), ...options]);
}

// it is possible to add fields into the `InfluxQueryTag` structures, and they do work,
// but in some cases, when we do metadata queries, we have to remove them from the queries.
function filterTags(parts: InfluxQueryTag[], allTagKeys: Set<string>): InfluxQueryTag[] {
  return parts.filter((t) => allTagKeys.has(t.key));
}

export const Editor = (props: Props): JSX.Element => {
  const uniqueId = useUniqueId();
  const formatAsId = `influxdb-qe-format-as-${uniqueId}`;
  const orderByTimeId = `influxdb-qe-order-by${uniqueId}`;

  const styles = useStyles2(getStyles);
  const query = normalizeQuery(props.query);
  const { datasource } = props;
  const { measurement, policy } = query;

  const allTagKeys = useMemo(() => {
    return getTagKeysForMeasurementAndTags(measurement, policy, [], datasource).then((tags) => {
      return new Set(tags);
    });
  }, [measurement, policy, datasource]);

  const selectLists = useMemo(() => {
    const dynamicSelectPartOptions = new Map([
      [
        'field_0',
        () => {
          return measurement !== undefined
            ? getFieldKeysForMeasurement(measurement, policy, datasource)
            : Promise.resolve([]);
        },
      ],
    ]);
    return (query.select ?? []).map((sel) => makePartList(sel, dynamicSelectPartOptions));
  }, [measurement, policy, query.select, datasource]);

  // the following function is not complicated enough to memoize, but it's result
  // is used in both memoized and un-memoized parts, so we have no choice
  const getTagKeys = useMemo(() => {
    return () =>
      allTagKeys.then((keys) =>
        getTagKeysForMeasurementAndTags(measurement, policy, filterTags(query.tags ?? [], keys), datasource)
      );
  }, [measurement, policy, query.tags, datasource, allTagKeys]);

  const groupByList = useMemo(() => {
    const dynamicGroupByPartOptions = new Map([['tag_0', getTagKeys]]);

    return makePartList(query.groupBy ?? [], dynamicGroupByPartOptions);
  }, [getTagKeys, query.groupBy]);

  const onAppliedChange = (newQuery: InfluxQuery) => {
    props.onChange(newQuery);
    props.onRunQuery();
  };
  const handleFromSectionChange = (p: string | undefined, m: string | undefined) => {
    onAppliedChange({
      ...query,
      policy: p,
      measurement: m,
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
          policy={policy}
          measurement={measurement}
          getPolicyOptions={() => getAllPolicies(datasource)}
          getMeasurementOptions={(filter) =>
            withTemplateVariableOptions(
              allTagKeys.then((keys) =>
                getAllMeasurementsForTags(
                  filter === '' ? undefined : filter,
                  filterTags(query.tags ?? [], keys),
                  datasource
                )
              )
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
          getTagValueOptions={(key: string) =>
            withTemplateVariableOptions(
              allTagKeys.then((keys) =>
                getTagValues(key, measurement, policy, filterTags(query.tags ?? [], keys), datasource)
              )
            )
          }
        />
      </SegmentSection>
      {selectLists.map((sel, index) => (
        <SegmentSection key={index} label={index === 0 ? 'SELECT' : ''} fill={true}>
          <PartListSection
            parts={sel}
            getNewPartOptions={() => Promise.resolve(getNewSelectPartOptions())}
            onChange={(partIndex, newParams) => {
              const newQuery = changeSelectPart(query, index, partIndex, newParams);
              onAppliedChange(newQuery);
            }}
            onAddNewPart={(type) => {
              onAppliedChange(addNewSelectPart(query, type, index));
            }}
            onRemovePart={(partIndex) => {
              onAppliedChange(removeSelectPart(query, partIndex, index));
            }}
          />
        </SegmentSection>
      ))}
      <SegmentSection label="GROUP BY" fill={true}>
        <PartListSection
          parts={groupByList}
          getNewPartOptions={() => getNewGroupByPartOptions(query, getTagKeys)}
          onChange={(partIndex, newParams) => {
            const newQuery = changeGroupByPart(query, partIndex, newParams);
            onAppliedChange(newQuery);
          }}
          onAddNewPart={(type) => {
            onAppliedChange(addNewGroupByPart(query, type));
          }}
          onRemovePart={(partIndex) => {
            onAppliedChange(removeGroupByPart(query, partIndex));
          }}
        />
      </SegmentSection>
      <SegmentSection label="TIMEZONE" fill={true}>
        <InputSection
          placeholder="(optional)"
          value={query.tz}
          onChange={(tz) => {
            onAppliedChange({ ...query, tz });
          }}
        />
        <InlineLabel htmlFor={orderByTimeId} width="auto" className={styles.inlineLabel}>
          ORDER BY TIME
        </InlineLabel>
        <OrderByTimeSection
          inputId={orderByTimeId}
          value={query.orderByTime === 'DESC' ? 'DESC' : 'ASC' /* FIXME: make this shared with influx_query_model */}
          onChange={(v) => {
            onAppliedChange({ ...query, orderByTime: v });
          }}
        />
      </SegmentSection>
      {/* query.fill is ignored in the query-editor, and it is deleted whenever
          query-editor changes. the influx_query_model still handles it, but the new
          approach seem to be to handle "fill" inside query.groupBy. so, if you
          have a panel where in the json you have query.fill, it will be applied,
          as long as you do not edit that query. */}
      <SegmentSection label="LIMIT" fill={true}>
        <InputSection
          placeholder="(optional)"
          value={query.limit?.toString()}
          onChange={(limit) => {
            onAppliedChange({ ...query, limit });
          }}
        />
        <InlineLabel width="auto" className={styles.inlineLabel}>
          SLIMIT
        </InlineLabel>
        <InputSection
          placeholder="(optional)"
          value={query.slimit?.toString()}
          onChange={(slimit) => {
            onAppliedChange({ ...query, slimit });
          }}
        />
      </SegmentSection>
      <SegmentSection htmlFor={formatAsId} label="FORMAT AS" fill={true}>
        <FormatAsSection
          inputId={formatAsId}
          format={query.resultFormat ?? DEFAULT_RESULT_FORMAT}
          onChange={(format) => {
            onAppliedChange({ ...query, resultFormat: format });
          }}
        />
        {query.resultFormat !== 'table' && (
          <>
            <InlineLabel width="auto" className={styles.inlineLabel}>
              ALIAS
            </InlineLabel>
            <InputSection
              isWide
              placeholder="Naming pattern"
              value={query.alias}
              onChange={(alias) => {
                onAppliedChange({ ...query, alias });
              }}
            />
          </>
        )}
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
