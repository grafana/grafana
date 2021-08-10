import React, { useMemo } from 'react';
import { InfluxQuery, InfluxQueryTag } from '../../types';
import { getTemplateSrv } from '@grafana/runtime';
import InfluxDatasource from '../../datasource';
import { FromSection } from './FromSection';
import { TagsSection } from './TagsSection';
import { PartListSection } from './PartListSection';
import { OrderByTimeSection } from './OrderByTimeSection';
import { InputSection } from './InputSection';
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
import { FormatAsSection } from './FormatAsSection';
import { SectionLabel } from './SectionLabel';
import { SectionFill } from './SectionFill';
import { DEFAULT_RESULT_FORMAT } from '../constants';
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

const SectionWrap = ({ initialName, children }: { initialName: string; children: React.ReactNode }) => (
  <div className="gf-form-inline">
    <SectionLabel name={initialName} isInitial={true} />
    {children}
    <SectionFill />
  </div>
);

export const Editor = (props: Props): JSX.Element => {
  const query = normalizeQuery(props.query);
  const { datasource } = props;
  const { measurement, policy } = query;

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
    return () => getTagKeysForMeasurementAndTags(measurement, policy, query.tags ?? [], datasource);
  }, [measurement, policy, query.tags, datasource]);

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
      <SectionWrap initialName="from">
        <FromSection
          policy={policy}
          measurement={measurement}
          getPolicyOptions={() => getAllPolicies(datasource)}
          getMeasurementOptions={(filter) =>
            withTemplateVariableOptions(
              getAllMeasurementsForTags(filter === '' ? undefined : filter, query.tags ?? [], datasource)
            )
          }
          onChange={handleFromSectionChange}
        />
        <SectionLabel name="where" />
        <TagsSection
          tags={query.tags ?? []}
          onChange={handleTagsSectionChange}
          getTagKeyOptions={getTagKeys}
          getTagValueOptions={(key: string) =>
            withTemplateVariableOptions(getTagValues(key, measurement, policy, query.tags ?? [], datasource))
          }
        />
      </SectionWrap>
      {selectLists.map((sel, index) => (
        <SectionWrap key={index} initialName={index === 0 ? 'select' : ''}>
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
        </SectionWrap>
      ))}
      <SectionWrap initialName="group by">
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
      </SectionWrap>
      <SectionWrap initialName="timezone">
        <InputSection
          placeholder="(optional)"
          value={query.tz}
          onChange={(tz) => {
            onAppliedChange({ ...query, tz });
          }}
        />
        <SectionLabel name="order by time" />
        <OrderByTimeSection
          value={query.orderByTime === 'DESC' ? 'DESC' : 'ASC' /* FIXME: make this shared with influx_query_model */}
          onChange={(v) => {
            onAppliedChange({ ...query, orderByTime: v });
          }}
        />
      </SectionWrap>
      {/* query.fill is ignored in the query-editor, and it is deleted whenever
          query-editor changes. the influx_query_model still handles it, but the new
          approach seem to be to handle "fill" inside query.groupBy. so, if you
          have a panel where in the json you have query.fill, it will be appled,
          as long as you do not edit that query. */}
      <SectionWrap initialName="limit">
        <InputSection
          placeholder="(optional)"
          value={query.limit?.toString()}
          onChange={(limit) => {
            onAppliedChange({ ...query, limit });
          }}
        />
        <SectionLabel name="slimit" />
        <InputSection
          placeholder="(optional)"
          value={query.slimit?.toString()}
          onChange={(slimit) => {
            onAppliedChange({ ...query, slimit });
          }}
        />
      </SectionWrap>
      <SectionWrap initialName="format as">
        <FormatAsSection
          format={query.resultFormat ?? DEFAULT_RESULT_FORMAT}
          onChange={(format) => {
            onAppliedChange({ ...query, resultFormat: format });
          }}
        />
        {query.resultFormat !== 'table' && (
          <>
            <SectionLabel name="alias" />
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
      </SectionWrap>
    </div>
  );
};
