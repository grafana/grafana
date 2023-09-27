import { reduce } from 'lodash';

import { escapeRegex, ScopedVars } from '@grafana/data/src';

import { TemplateSrv } from '../../../features/templating/template_srv';

import { InfluxQueryTag, MetadataQueryType } from './types';

export const buildMetadataQuery = (params: {
  type: MetadataQueryType;
  templateService: TemplateSrv;
  scopedVars?: ScopedVars;
  database?: string;
  measurement?: string;
  retentionPolicy?: string;
  tags?: InfluxQueryTag[];
  withKey?: string;
  withMeasurementFilter?: string;
}): string => {
  let query = '';
  let {
    type,
    templateService,
    scopedVars,
    database,
    measurement,
    retentionPolicy,
    tags,
    withKey,
    withMeasurementFilter,
  } = params;

  switch (type) {
    case 'RETENTION_POLICIES':
      return 'SHOW RETENTION POLICIES on "' + database + '"';
    case 'FIELDS':
      if (!measurement || measurement === '') {
        return 'SHOW FIELD KEYS';
      }

      // If there is a measurement and it is not empty string
      if (measurement && !measurement.match(/^\/.*\/|^$/)) {
        measurement = '"' + measurement + '"';

        if (retentionPolicy && retentionPolicy !== 'default') {
          retentionPolicy = '"' + retentionPolicy + '"';
          measurement = retentionPolicy + '.' + measurement;
        }
      }

      return 'SHOW FIELD KEYS FROM ' + measurement;
    case 'TAG_KEYS':
      query = 'SHOW TAG KEYS';
      break;
    case 'TAG_VALUES':
      query = 'SHOW TAG VALUES';
      break;
    case 'MEASUREMENTS':
      query = 'SHOW MEASUREMENTS';
      if (withMeasurementFilter) {
        // we do a case-insensitive regex-based lookup
        query += ' WITH MEASUREMENT =~ /(?i)' + escapeRegex(withMeasurementFilter) + '/';
      }
      break;
    default:
      return query;
  }
  if (measurement) {
    if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
      measurement = '"' + measurement + '"';
    }

    if (retentionPolicy && retentionPolicy !== 'default') {
      retentionPolicy = '"' + retentionPolicy + '"';
      measurement = retentionPolicy + '.' + measurement;
    }

    if (measurement !== '') {
      query += ' FROM ' + measurement;
    }
  }

  if (withKey) {
    let keyIdentifier = withKey;

    if (keyIdentifier.endsWith('::tag')) {
      keyIdentifier = keyIdentifier.slice(0, -5);
    }

    query += ' WITH KEY = "' + keyIdentifier + '"';
  }

  if (tags && tags.length > 0) {
    const whereConditions = reduce<InfluxQueryTag, string[]>(
      tags,
      (memo, tag) => {
        // do not add a condition for the key we want to explore for
        if (tag.key && tag.key === withKey) {
          return memo;
        }

        // value operators not supported in these types of queries
        if (tag.operator === '>' || tag.operator === '<') {
          return memo;
        }

        memo.push(renderTagCondition(tag, memo.length, templateService, scopedVars, true));
        return memo;
      },
      []
    );

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' ');
    }
  }

  if (type === 'MEASUREMENTS') {
    query += ' LIMIT 100';
    //Solve issue #2524 by limiting the number of measurements returned
    //LIMIT must be after WITH MEASUREMENT and WHERE clauses
    //This also could be used for TAG KEYS and TAG VALUES, if desired
  }

  return query;
};

// A merge of query_builder/renderTagCondition and influx_query_model/renderTagCondition
export function renderTagCondition(
  tag: InfluxQueryTag,
  index: number,
  templateSrv: TemplateSrv,
  scopedVars?: ScopedVars,
  interpolate?: boolean
) {
  let str = '';
  let operator = tag.operator;
  let value = tag.value;
  if (index > 0) {
    str = (tag.condition || 'AND') + ' ';
  }

  if (!operator) {
    if (/^\/.*\/$/.test(tag.value)) {
      operator = '=~';
    } else {
      operator = '=';
    }
  }

  // quote value unless regex or empty-string
  // Influx versions before 0.13 had inconsistent requirements on if (numeric) tags are quoted or not.
  if (value === '' || (operator !== '=~' && operator !== '!~')) {
    value = "'" + value.replace(/\\/g, '\\\\').replace(/\'/g, "\\'") + "'";
  }

  // quote value unless regex
  if (operator !== '=~' && operator !== '!~') {
    if (interpolate) {
      value = templateSrv.replace(value, scopedVars);
    } else if (operator !== '>' && operator !== '<') {
      value = "'" + value.replace(/\\/g, '\\\\').replace(/\'/g, "\\'") + "'";
    }
  } else if (interpolate) {
    value = templateSrv.replace(value, scopedVars, 'regex');
  }

  let escapedKey = `"${tag.key}"`;

  if (tag.key.endsWith('::tag')) {
    escapedKey = `"${tag.key.slice(0, -5)}"::tag`;
  }

  if (tag.key.endsWith('::field')) {
    escapedKey = `"${tag.key.slice(0, -7)}"::field`;
  }

  return str + escapedKey + ' ' + operator + ' ' + value;
}
