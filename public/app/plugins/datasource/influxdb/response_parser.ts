import { each, flatten, groupBy, isArray } from 'lodash';

import { AnnotationEvent, DataFrame, FieldType, QueryResultMeta } from '@grafana/data';
import { BackendDataSourceResponse, FetchResponse, toDataQueryResponse } from '@grafana/runtime';
import TableModel from 'app/core/TableModel';

import { InfluxQuery } from './types';

export default class ResponseParser {
  parse(query: string, results: { results: any }) {
    if (!results?.results || results.results.length === 0) {
      return [];
    }

    const influxResults = results.results[0];
    if (!influxResults.series) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    const isRetentionPolicyQuery = normalizedQuery.indexOf('show retention policies') >= 0;
    const isValueFirst = normalizedQuery.indexOf('show field keys') >= 0 || isRetentionPolicyQuery;

    const res = new Set<string>();
    each(influxResults.series, (serie) => {
      each(serie.values, (value) => {
        if (isArray(value)) {
          // In general, there are 2 possible shapes for the returned value.
          // The first one is a two-element array,
          // where the first element is somewhat a metadata value:
          // the tag name for SHOW TAG VALUES queries,
          // the time field for SELECT queries, etc.
          // The second shape is an one-element array,
          // that is containing an immediate value.
          // For example, SHOW FIELD KEYS queries return such shape.
          // Note, pre-0.11 versions return
          // the second shape for SHOW TAG VALUES queries
          // (while the newer versions—first).

          if (isValueFirst) {
            // We want to know whether the given retention policy is the default one or not.
            // If it is default policy then we should add it to the beginning.
            // The index 4 gives us if that policy is default or not.
            // https://docs.influxdata.com/influxdb/v1.8/query_language/explore-schema/#show-retention-policies
            // Only difference is v0.9. In that version we don't receive shardGroupDuration value.
            // https://archive.docs.influxdata.com/influxdb/v0.9/query_language/schema_exploration/#show-retention-policies
            // Since it is always the last value we will check that last value always.
            if (isRetentionPolicyQuery && value[value.length - 1] === true) {
              const newSetValues = [value[0].toString(), ...Array.from(res)];
              res.clear();
              newSetValues.forEach((sv) => res.add(sv));
            } else {
              res.add(value[0].toString());
            }
          } else if (value[1] !== undefined) {
            res.add(value[1].toString());
          } else {
            res.add(value[0].toString());
          }
        } else {
          res.add(value.toString());
        }
      });
    });

    // NOTE: it is important to keep the order of items in the parsed output
    // the same as it was in the influxdb-response.
    // we use a `Set` to collect the unique-results, and `Set` iteration
    // order is insertion-order, so this should be ok.
    return Array.from(res).map((v) => ({ text: v }));
  }

  getTable(dfs: DataFrame[], target: InfluxQuery, meta: QueryResultMeta): TableModel {
    let table = new TableModel();

    if (dfs.length > 0) {
      table.meta = {
        ...meta,
        executedQueryString: dfs[0].meta?.executedQueryString,
      };

      table.refId = target.refId;
      table = getTableCols(dfs, table, target);

      // if group by tag(s) added
      if (dfs[0].fields[1] && dfs[0].fields[1].labels) {
        let dfsByLabels = groupBy(dfs, (df: DataFrame) =>
          df.fields[1].labels ? Object.values(df.fields[1].labels!) : null
        );
        const labels = Object.keys(dfsByLabels);
        const dfsByLabelValues = Object.values(dfsByLabels);

        for (let i = 0; i < dfsByLabelValues.length; i++) {
          table = getTableRows(dfsByLabelValues[i], table, [...labels[i].split(',')]);
        }
      } else {
        table = getTableRows(dfs, table, []);
      }
    }

    return table;
  }

  async transformAnnotationResponse(
    annotation: InfluxQuery,
    data: FetchResponse<BackendDataSourceResponse>,
    target: InfluxQuery
  ): Promise<AnnotationEvent[]> {
    const rsp = toDataQueryResponse(data, [target]);

    if (!rsp) {
      return [];
    }

    const table = this.getTable(rsp.data, target, {});
    const list: any[] = [];
    let titleColIndex = 0;
    let timeColIndex = 0;
    let timeEndColIndex = 0;
    let textColIndex = 0;
    const tagsColIndexes: number[] = [];

    each(table.columns, (column, index) => {
      if (column.text.toLowerCase() === 'time') {
        timeColIndex = index;
        return;
      }
      if (column.text === annotation.titleColumn) {
        titleColIndex = index;
        return;
      }
      if (colContainsTag(column.text, annotation.tagsColumn)) {
        tagsColIndexes.push(index);
        return;
      }
      if (annotation.textColumn && column.text.includes(annotation.textColumn)) {
        textColIndex = index;
        return;
      }
      if (column.text === annotation.timeEndColumn) {
        timeEndColIndex = index;
        return;
      }
      // legacy case
      if (!titleColIndex && textColIndex !== index) {
        titleColIndex = index;
      }
    });

    each(table.rows, (value) => {
      const data = {
        annotation: annotation,
        time: +new Date(value[timeColIndex]),
        title: value[titleColIndex],
        timeEnd: value[timeEndColIndex],
        // Remove empty values, then split in different tags for comma separated values
        tags: flatten(
          tagsColIndexes
            .filter((t) => {
              return value[t];
            })
            .map((t) => {
              return value[t].split(',');
            })
        ),
        text: value[textColIndex],
      };

      list.push(data);
    });

    return list;
  }
}

function colContainsTag(colText: string, tagsColumn?: string): boolean {
  const tags = (tagsColumn || '').replace(' ', '').split(',');
  for (const tag of tags) {
    if (tag !== '' && colText.includes(tag)) {
      return true;
    }
  }
  return false;
}

function getTableCols(dfs: DataFrame[], table: TableModel, target: InfluxQuery): TableModel {
  const selectedParams = getSelectedParams(target);

  dfs[0].fields.forEach((field) => {
    // Time col
    if (field.name.toLowerCase() === 'time') {
      table.columns.push({ text: 'Time', type: FieldType.time });
    }

    // Group by (label) column(s)
    else if (field.name.toLowerCase() === 'value') {
      if (field.labels) {
        Object.keys(field.labels).forEach((key) => {
          table.columns.push({ text: key });
        });
      }
    }
  });

  // Get cols for annotationQuery
  if (dfs[0].refId === 'metricFindQuery') {
    dfs.forEach((field) => {
      if (field.name) {
        table.columns.push({ text: field.name });
      }
    });
  }

  // Select (metric) column(s)
  for (let i = 0; i < selectedParams.length; i++) {
    table.columns.push({ text: selectedParams[i] });
  }

  // ISSUE: https://github.com/grafana/grafana/issues/63842
  // if rawQuery and
  // has other selected fields in the query and
  // dfs field names are in the rawQuery but
  // the selected params object doesn't exist in the query then
  // add columns to the table
  if (
    target.rawQuery &&
    selectedParams.length === 0 &&
    rawQuerySelectedFieldsInDataframe(target.query, dfs) &&
    dfs[0].refId !== 'metricFindQuery'
  ) {
    dfs.map((df) => {
      if (df.name) {
        table.columns.push({ text: df.name });
      }
    });
  }

  return table;
}

function getTableRows(dfs: DataFrame[], table: TableModel, labels: string[]): TableModel {
  const values = dfs[0].fields[0].values;

  for (let i = 0; i < values.length; i++) {
    const time = values[i];
    const metrics = dfs.map((df: DataFrame) => {
      return df.fields[1] ? df.fields[1].values[i] : null;
    });
    if (metrics.indexOf(null) < 0) {
      table.rows.push([time, ...labels, ...metrics]);
    }
  }
  return table;
}

export function getSelectedParams(target: InfluxQuery): string[] {
  let allParams: string[] = [];
  target.select?.forEach((select) => {
    const selector = select.filter((x) => x.type !== 'field');
    if (selector.length > 0) {
      const aliasIfExist = selector.find((s) => s.type === 'alias');
      if (aliasIfExist) {
        allParams.push(aliasIfExist.params?.[0].toString() ?? '');
      } else {
        allParams.push(selector[0].type);
      }
    } else {
      if (select[0] && select[0].params && select[0].params[0]) {
        allParams.push(select[0].params[0].toString());
      }
    }
  });

  let uniqueParams: string[] = [];
  allParams.forEach((param) => {
    uniqueParams.push(incrementName(param, param, uniqueParams, 0));
  });

  return uniqueParams;
}

function incrementName(name: string, nameIncrement: string, params: string[], index: number): string {
  if (params.indexOf(nameIncrement) > -1) {
    index++;
    return incrementName(name, name + '_' + index, params, index);
  }
  return nameIncrement;
}

function rawQuerySelectedFieldsInDataframe(query: string | undefined, dfs: DataFrame[]) {
  const names: Array<string | undefined> = dfs.map((df: DataFrame) => df.name);

  const colsInRawQuery = names.every((name: string | undefined) => {
    if (name && query) {
      // table name and field, i.e. cpu.usage_guest_nice becomes ['cpu', 'usage_guest_nice']
      const nameParts = name.split('.');

      return nameParts.every((np) => query.toLowerCase().includes(np.toLowerCase()));
    }

    return false;
  });

  const queryChecks = ['*', 'SHOW'];

  const otherChecks: boolean = queryChecks.some((qc: string) => {
    if (query) {
      return query.toLowerCase().includes(qc.toLowerCase());
    }

    return false;
  });

  return colsInRawQuery || otherChecks;
}
