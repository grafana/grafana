import React, { FC } from 'react';
import { InfluxQuery, InfluxQueryTag, InfluxQueryPart, ResultFormat } from '../../types';
import { SelectableValue } from '@grafana/data';
import InfluxDatasource from '../../datasource';
import { FromSection } from './FromSection';
import { TagsSection } from './TagsSection';
import { PartListSection } from './PartListSection';
import { OrderByTimeSection } from './OrderByTimeSection';
import { SimpleSection } from './SimpleSection';
import InfluxQueryModel from '../../influx_query_model';
import { unwrap } from './unwrap';
import {
  getAllMeasurements,
  getAllPolicies,
  getFieldKeysForMeasurement,
  getTagKeysForMeasurement,
  getTagValues,
} from '../../influxQLMetadataQuery';
import { Select } from '@grafana/ui';
import queryPart from '../../query_part';
import { QueryPartDef } from '../../../../../core/components/query_part/query_part';

// FIXME: what makes this default?
const DEFAULT_RESULT_FORMAT: ResultFormat = 'time_series';

// FIXME: duplicated
const RESULT_FORMATS: Array<SelectableValue<ResultFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
  { label: 'Logs', value: 'logs' },
];

// notes about strange combinations:
// - if a tag has a strange `operator` (XOR), it just gets written into the query
//   - the UI will show it even
// - if a non-first tag has a missing `condition` it is assumed it is `AND`
// - if a tag has a missing `operator` it is assumed it is `=`

function getRenderedQuery(query: InfluxQuery): string {
  const queryCopy = { ...query }; // the query-model mutates the query
  return new InfluxQueryModel(queryCopy).render(false);
}

type Props = {
  query: InfluxQuery;
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  datasource: InfluxDatasource;
};

function normalizeQuery(query: InfluxQuery): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  return new InfluxQueryModel(queryCopy).target;
}

function addNewSelectPart(query: InfluxQuery, type: string, index: number): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.addSelectPart(model.selectModels[index], type);
  return model.target;
}

function removeSelectPart(query: InfluxQuery, partIndex: number, index: number): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  const selectModel = model.selectModels[index];
  model.removeSelectPart(selectModel, selectModel[partIndex]);
  return model.target;
}

function addNewGroupByPart(query: InfluxQuery, type: string): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.addGroupBy(type);
  return model.target;
}

function removeGroupByPart(query: InfluxQuery, partIndex: number): InfluxQuery {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  model.removeGroupByPart(model.groupByParts[partIndex], partIndex);
  return model.target;
}

type Categories = Record<string, QueryPartDef[]>;

function getNewSelectPartOptions(): SelectableValue[] {
  const categories: Categories = queryPart.getCategories();
  const options: SelectableValue[] = [];

  const keys = Object.keys(categories);
  keys.sort(); // to make sure they are alphabetically sorted

  keys.forEach((key) => {
    const children: SelectableValue[] = categories[key].map((x) => ({
      value: x.type,
      label: x.type,
    }));

    options.push({
      label: key,
      options: children,
    });
  });

  return options;
}

function getNewGroupByPartOptions(query: InfluxQuery): Array<SelectableValue<string>> {
  const queryCopy = { ...query }; // the query-model mutates the query
  const model = new InfluxQueryModel(queryCopy);
  const options: Array<SelectableValue<string>> = [];
  if (!model.hasFill()) {
    options.push({
      label: 'fill(null)',
      value: 'fill(null)',
    });
  }
  if (!model.hasGroupByTime()) {
    options.push({
      label: 'time($interval)',
      value: 'time($interval)',
    });
  }
  options.push({
    label: 'tag(tagName)',
    value: 'tag(tagName)',
  });
  return options;
}

type PartParams = Array<{
  value: string;
  options: (() => Promise<string[]>) | null;
}>;

type Part = {
  name: string;
  params: PartParams;
};

function getPartParams(part: InfluxQueryPart, dynamicParamOptions: Map<string, () => Promise<string[]>>): PartParams {
  // NOTE: the way the system is constructed,
  // there always can only be one possible dynamic-lookup
  // field. in case of select it is the field,
  // in case of group-by it is the tag
  const def = queryPart.create(part).def;

  // we switch the numbers to strings, it will work that way too,
  // and it makes the code simpler
  const paramValues = (part.params ?? []).map((p) => p.toString());

  if (paramValues.length !== def.params.length) {
    throw new Error('Invalid query-segment');
  }

  return paramValues.map((val, index) => {
    const defParam = def.params[index];
    if (defParam.dynamicLookup) {
      return {
        value: val,
        options: unwrap(dynamicParamOptions.get(`${def.type}_${index}`)),
      };
    }

    if (defParam.options != null) {
      return {
        value: val,
        options: () => Promise.resolve(defParam.options),
      };
    }

    return {
      value: val,
      options: null,
    };
  });
}

function makePartList(
  queryParts: InfluxQueryPart[],
  dynamicParamOptions: Map<string, () => Promise<string[]>>
): Part[] {
  return queryParts.map((qp) => {
    return {
      name: qp.type,
      params: getPartParams(qp, dynamicParamOptions),
    };
  });
}

export const Editor: FC<Props> = (props) => {
  const query = normalizeQuery(props.query);
  const { datasource } = props;
  const onAppliedChange = (newQuery: InfluxQuery) => {
    props.onChange(newQuery);
    props.onRunQuery();
  };
  const handleFromSectionChange = (policy: string | undefined, measurement: string | undefined) => {
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

  const renderedQuery = getRenderedQuery(query);

  const dynamicSelectPartOptions = new Map([
    ['field_0', () => getFieldKeysForMeasurement(unwrap(query.measurement), query.policy, datasource)],
  ]);
  const selectLists = (query.select ?? []).map((sel) => makePartList(sel, dynamicSelectPartOptions));

  const dynamicGroupByPartOptions = new Map([
    ['tag_0', () => getTagKeysForMeasurement(unwrap(query.measurement), query.policy, datasource)],
  ]);

  const groupByList = makePartList(query.groupBy ?? [], dynamicGroupByPartOptions);

  return (
    <div>
      <FromSection
        policy={query.policy}
        measurement={query.measurement}
        getAllPolicies={() => getAllPolicies(datasource)}
        getAllMeasurements={() => getAllMeasurements(datasource)}
        onChange={handleFromSectionChange}
      />
      <TagsSection
        tags={query.tags ?? []}
        onChange={handleTagsSectionChange}
        getTagKeys={() => getTagKeysForMeasurement(unwrap(query.measurement), query.policy, datasource)}
        getTagValuesForKey={(key: string) => getTagValues(key, unwrap(query.measurement), query.policy, datasource)}
      />
      {selectLists.map((sel, index) => (
        <PartListSection
          name="Select"
          key={index.toString()}
          parts={sel}
          newPartOptions={getNewSelectPartOptions()}
          onChange={(partIndex, newParams) => {
            const newSel = [...(query.select ?? [])];
            newSel[index] = [...newSel[index]];
            newSel[index][partIndex] = {
              ...newSel[index][partIndex],
              params: newParams,
            };
            onAppliedChange({ ...query, select: newSel });
          }}
          onAddNewPart={(type) => {
            onAppliedChange(addNewSelectPart(query, type, index));
          }}
          onRemovePart={(partIndex) => {
            onAppliedChange(removeSelectPart(query, partIndex, index));
          }}
        />
      ))}
      <PartListSection
        name="Group by"
        parts={groupByList}
        newPartOptions={getNewGroupByPartOptions(query)}
        onChange={(partIndex, newParams) => {
          const newGroupBy = [...(query.groupBy ?? [])];
          newGroupBy[partIndex] = {
            ...newGroupBy[partIndex],
            params: newParams,
          };
          onAppliedChange({ ...query, groupBy: newGroupBy });
        }}
        onAddNewPart={(type) => {
          onAppliedChange(addNewGroupByPart(query, type));
        }}
        onRemovePart={(partIndex) => {
          onAppliedChange(removeGroupByPart(query, partIndex));
        }}
      />
      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">Format as</label>
        <Select
          className="width-9"
          onChange={(v) => {
            onAppliedChange({ ...query, resultFormat: v.value });
          }}
          value={query.resultFormat ?? DEFAULT_RESULT_FORMAT}
          options={RESULT_FORMATS}
        />
        <div className="gf-form gf-form--grow">
          <label className="gf-form-label gf-form-label--grow"></label>
        </div>
      </div>
      {/* query.fill is ignored in the query-editor, and it is deleted whenever
          query-editor changes. the influx_query_model still handles it, but the new
          approach seem to be to handle "fill" inside query.groupBy. so, if you
          have a panel where in the json you have query.fill, it will be appled,
          as long as you do not edit that query. */}
      <OrderByTimeSection
        value={query.orderByTime === 'DESC' ? 'DESC' : 'ASC' /* FIXME: sync with influx_query_model */}
        onChange={(v) => {
          onAppliedChange({ ...query, orderByTime: v });
        }}
      />
      <SimpleSection
        name="limit"
        value={query.limit}
        onChange={(limit) => {
          onAppliedChange({ ...query, limit });
        }}
      />
      <SimpleSection
        name="slimit"
        value={query.slimit}
        onChange={(slimit) => {
          onAppliedChange({ ...query, slimit });
        }}
      />
      <SimpleSection
        name="tz"
        value={query.tz}
        onChange={(tz) => {
          onAppliedChange({ ...query, tz });
        }}
      />
      <SimpleSection
        name="alias"
        value={query.alias}
        onChange={(alias) => {
          onAppliedChange({ ...query, alias });
        }}
      />
      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">rendered</label>
        {renderedQuery}
        <div className="gf-form gf-form--grow">
          <label className="gf-form-label gf-form-label--grow"></label>
        </div>
      </div>
    </div>
  );
};
