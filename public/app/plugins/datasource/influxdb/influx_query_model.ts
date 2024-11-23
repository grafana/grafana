import { filter, find, indexOf, map } from 'lodash';

import { AdHocVariableFilter, escapeRegex, ScopedVars } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import { QueryPart } from 'app/features/alerting/state/query_part';

import { removeRegexWrapper } from './queryUtils';
import queryPart from './query_part';
import { DEFAULT_POLICY, InfluxQuery, InfluxQueryTag } from './types';

export default class InfluxQueryModel {
  target: InfluxQuery;
  selectModels: QueryPart[][] = [];
  groupByParts: QueryPart[] = [];
  templateSrv: any;
  scopedVars: ScopedVars | undefined;
  refId?: string;

  constructor(target: InfluxQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars) {
    this.target = target;
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;

    target.policy = target.policy || DEFAULT_POLICY;
    target.resultFormat = target.resultFormat || 'time_series';
    target.orderByTime = target.orderByTime || 'ASC';
    target.tags = target.tags || [];
    target.groupBy = target.groupBy || [
      { type: 'time', params: ['$__interval'] },
      { type: 'fill', params: ['null'] },
    ];
    target.select = target.select || [
      [
        { type: 'field', params: ['value'] },
        { type: 'mean', params: [] },
      ],
    ];

    this.updateProjection();
  }

  updateProjection() {
    this.selectModels = map(this.target.select, (parts) => {
      return map(parts, queryPart.create);
    });
    this.groupByParts = map(this.target.groupBy, queryPart.create);
  }

  updatePersistedParts() {
    this.target.select = map(this.selectModels, (selectParts) => {
      return map(selectParts, (part) => {
        return { type: part.def.type, params: part.params };
      });
    });
  }

  hasGroupByTime() {
    return find(this.target.groupBy, (g) => g.type === 'time');
  }

  hasFill() {
    return find(this.target.groupBy, (g) => g.type === 'fill');
  }

  addGroupBy(value: string) {
    let stringParts = value.match(/^(\w+)\((.*)\)$/);

    if (!stringParts || !this.target.groupBy) {
      return;
    }

    const typePart = stringParts[1];
    const arg = stringParts[2];
    const partModel = queryPart.create({ type: typePart, params: [arg] });
    const partCount = this.target.groupBy.length;

    if (partCount === 0) {
      this.target.groupBy.push(partModel.part);
    } else if (typePart === 'time') {
      this.target.groupBy.splice(0, 0, partModel.part);
    } else if (typePart === 'tag') {
      if (this.target.groupBy[partCount - 1].type === 'fill') {
        this.target.groupBy.splice(partCount - 1, 0, partModel.part);
      } else {
        this.target.groupBy.push(partModel.part);
      }
    } else {
      this.target.groupBy.push(partModel.part);
    }

    this.updateProjection();
  }

  removeGroupByPart(part: { def: { type: string } }, index: number) {
    const categories = queryPart.getCategories();

    if (part.def.type === 'time') {
      // remove fill
      this.target.groupBy = filter(this.target.groupBy, (g) => g.type !== 'fill');
      // remove aggregations
      this.target.select = map(this.target.select, (s) => {
        return filter(s, (part) => {
          const partModel = queryPart.create(part);
          if (partModel.def.category === categories.Aggregations) {
            return false;
          }
          if (partModel.def.category === categories.Selectors) {
            return false;
          }
          return true;
        });
      });
    }

    this.target.groupBy!.splice(index, 1);
    this.updateProjection();
  }

  removeSelect(index: number) {
    this.target.select!.splice(index, 1);
    this.updateProjection();
  }

  removeSelectPart(selectParts: QueryPart[], part: QueryPart) {
    // if we remove the field remove the whole statement
    if (part.def.type === 'field') {
      if (this.selectModels.length > 1) {
        const modelsIndex = indexOf(this.selectModels, selectParts);
        this.selectModels.splice(modelsIndex, 1);
      }
    } else {
      const partIndex = indexOf(selectParts, part);
      selectParts.splice(partIndex, 1);
    }

    this.updatePersistedParts();
  }

  addSelectPart(selectParts: QueryPart[], type: string) {
    const partModel = queryPart.create({ type: type });
    partModel.def.addStrategy(selectParts, partModel, this);
    this.updatePersistedParts();
  }

  private isOperatorTypeHandler(operator: string, value: string, fieldName: string) {
    let textValue;
    if (operator === 'Is Not') {
      operator = '!=';
    } else {
      operator = '=';
    }

    // Tags should always quote
    if (fieldName.endsWith('::tag')) {
      textValue = "'" + removeRegexWrapper(value.replace(/\\/g, '\\\\').replace(/\'/g, "\\'")) + "'";
      return {
        operator: operator,
        value: textValue,
      };
    }

    let lowerValue = value.toLowerCase();

    // Try and discern type
    if (!isNaN(parseFloat(value))) {
      // Integer or float, don't quote
      textValue = value;
    } else if (['true', 'false'].includes(lowerValue)) {
      // It's a boolean, don't quite
      textValue = lowerValue;
    } else {
      // String or unrecognised: quote
      textValue = "'" + removeRegexWrapper(value.replace(/\\/g, '\\\\').replace(/\'/g, "\\'")) + "'";
    }
    return {
      operator: operator,
      value: textValue,
    };
  }

  private renderTagCondition(tag: InfluxQueryTag, index: number, interpolate?: boolean) {
    // FIXME: merge this function with query_builder/renderTagCondition
    let str = '';
    let operator = tag.operator;
    let value = tag.value;
    if (index > 0) {
      str = (tag.condition || 'AND') + ' ';
    }

    if (!operator) {
      if (/^\/.*\/$/.test(value)) {
        operator = '=~';
      } else {
        operator = '=';
      }
    }

    // quote value unless regex
    if (operator !== '=~' && operator !== '!~') {
      if (interpolate) {
        value = this.templateSrv.replace(value, this.scopedVars);
      }
      value = removeRegexWrapper(value);
      if (operator.startsWith('Is')) {
        let r = this.isOperatorTypeHandler(operator, value, tag.key);
        operator = r.operator;
        value = r.value;
      } else if ((!operator.startsWith('>') && !operator.startsWith('<')) || operator === '<>') {
        value = "'" + value.replace(/\\/g, '\\\\').replace(/\'/g, "\\'") + "'";
      }
    } else if (interpolate) {
      value = this.templateSrv.replace(value, this.scopedVars, 'regex');
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

  getMeasurementAndPolicy(interpolate?: boolean) {
    let policy = this.target.policy;
    let measurement = this.target.measurement || 'measurement';

    if (!measurement.match('^/.*/$')) {
      measurement = '"' + measurement + '"';
    } else if (interpolate) {
      measurement = this.templateSrv.replace(measurement, this.scopedVars, 'regex');
    }

    if (policy !== DEFAULT_POLICY) {
      policy = '"' + this.target.policy + '".';
    } else {
      policy = '';
    }

    return policy + measurement;
  }

  interpolateQueryStr(value: string | string[], variable: { multi: boolean; includeAll: boolean }) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return value;
    }

    if (typeof value === 'string') {
      return escapeRegex(value);
    }

    const escapedValues = map(value, escapeRegex);
    return '(' + escapedValues.join('|') + ')';
  }

  render(interpolate?: boolean) {
    const target = this.target;

    if (target.rawQuery) {
      if (interpolate) {
        return this.templateSrv.replace(target.query, this.scopedVars, this.interpolateQueryStr);
      } else {
        return target.query;
      }
    }

    let query = 'SELECT ';
    let i, y;
    for (i = 0; i < this.selectModels.length; i++) {
      const parts = this.selectModels[i];
      let selectText = '';
      for (y = 0; y < parts.length; y++) {
        const part = parts[y];
        selectText = part.render(selectText);
      }

      if (i > 0) {
        query += ', ';
      }
      query += selectText;
    }

    query += ' FROM ' + this.getMeasurementAndPolicy(interpolate) + ' WHERE ';
    const conditions = map(target.tags, (tag, index) => {
      return this.renderTagCondition(tag, index, interpolate);
    });

    if (conditions.length > 0) {
      query += '(' + conditions.join(' ') + ') AND ';
    }

    query += '$timeFilter';

    let groupBySection = '';
    for (i = 0; i < this.groupByParts.length; i++) {
      const part = this.groupByParts[i];
      if (i > 0) {
        // for some reason fill has no separator
        groupBySection += part.def.type === 'fill' ? ' ' : ', ';
      }
      groupBySection += part.render('');
    }

    if (groupBySection.length) {
      query += ' GROUP BY ' + groupBySection;
    }

    if (target.fill) {
      query += ' fill(' + target.fill + ')';
    }

    if (target.orderByTime === 'DESC') {
      query += ' ORDER BY time DESC';
    }

    if (target.limit) {
      query += ' LIMIT ' + target.limit;
    }

    if (target.slimit) {
      query += ' SLIMIT ' + target.slimit;
    }

    if (target.tz) {
      query += " tz('" + target.tz + "')";
    }

    return query;
  }

  renderAdhocFilters(filters: AdHocVariableFilter[]) {
    const conditions = map(filters, (tag, index) => {
      return this.renderTagCondition(tag, index, true);
    });
    return conditions.join(' ');
  }
}
