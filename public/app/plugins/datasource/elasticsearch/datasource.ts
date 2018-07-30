import angular from 'angular';
import _ from 'lodash';
import ResponseTransformer from './response_transformer';

export class ElasticDatasource {
  id: string;
  name: string;
  timeField: string;
  responseTransformer: ResponseTransformer;

  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv, private timeSrv) {
    this.id = instanceSettings.id;
    this.name = instanceSettings.name;
    this.timeField = instanceSettings.jsonData.timeField;
    this.responseTransformer = new ResponseTransformer();
  }

  private post(data) {
    return this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: data,
    });
  }

  query(options) {
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    const targets = _.cloneDeep(options.targets);

    const queries = _.filter(targets, target => {
      return target.hide !== true;
    }).map(target => {
      const queryString = this.templateSrv.replace(target.query || '*', options.scopedVars, 'lucene');

      if (target.alias) {
        target.alias = this.templateSrv.replace(target.alias, options.scopedVars, 'lucene');
      }

      return {
        queryType: 'timeseries',
        refId: target.refId,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        datasourceId: this.id,
        timeField: target.timeField,
        alias: target.alias,
        query: queryString,
        bucketAggs: target.bucketAggs,
        metrics: target.metrics,
        adhocFilters: adhocFilters,
      };
    });

    if (queries.length === 0) {
      return this.$q.when({ data: [] });
    }

    return this.post({
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: queries,
    }).then(this.responseTransformer.transformTimeSeriesQueryResult);
  }

  annotationQuery(options) {
    const annotation = options.annotation;
    const queryInterpolated = this.templateSrv.replace(annotation.query, {}, 'lucene');

    return this.post({
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: [
        {
          queryType: 'annotation',
          refId: annotation.name,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: this.id,
          annotation: {
            timeField: annotation.timeField,
            textField: annotation.textField,
            tagsField: annotation.tagsField,
            query: queryInterpolated,
          },
        },
      ],
    }).then(data => this.responseTransformer.transformAnnotationQueryResponse(annotation, data));
  }

  testDatasource() {
    this.timeSrv.setTime({ from: 'now-1m', to: 'now' }, true);
    return this.getFields({ type: 'date' }, 'test').then(
      dateFields => {
        const timeField = _.find(dateFields, { text: this.timeField });
        if (!timeField) {
          return {
            status: 'error',
            message: 'No date field named ' + this.timeField + ' found',
          };
        }
        return { status: 'success', message: 'Index OK. Time field name OK.' };
      },
      err => {
        console.log(err);
        if (err.data && err.data.error) {
          let message = angular.toJson(err.data.error);
          if (err.data.error.reason) {
            message = err.data.error.reason;
          }
          return { status: 'error', message: message };
        } else {
          return { status: 'error', message: err.status };
        }
      }
    );
  }

  getFields(query, refId) {
    const range = this.timeSrv.timeRange();
    return this.post({
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
      queries: [
        {
          queryType: 'fields',
          refId: refId,
          datasourceId: this.id,
          fieldTypeFilter: query.type,
        },
      ],
    }).then(data => this.responseTransformer.transformFieldsQueryResponse(refId, data));
  }

  getTerms(queryDef, refId) {
    const range = this.timeSrv.timeRange();

    return this.post({
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
      queries: [
        {
          queryType: 'terms',
          refId: refId,
          datasourceId: this.id,
          field: queryDef.field,
          query: queryDef.query,
          size: queryDef.size,
        },
      ],
    }).then(data => this.responseTransformer.transformTermsQueryResponse(refId, data));
  }

  metricFindQuery(query, optionalOptions) {
    query = angular.fromJson(query);
    if (!query) {
      return this.$q.when([]);
    }

    let refId = 'tempvar';
    if (optionalOptions && optionalOptions.variable && optionalOptions.variable.name) {
      refId = optionalOptions.variable.name;
    }

    if (query.find === 'fields') {
      query.field = this.templateSrv.replace(query.field, {}, 'lucene');
      return this.getFields(query, refId);
    }

    if (query.find === 'terms') {
      query.field = this.templateSrv.replace(query.field, {}, 'lucene');
      query.query = this.templateSrv.replace(query.query || '*', {}, 'lucene');
      return this.getTerms(query, refId);
    }
  }

  getTagKeys() {
    return this.getFields({}, 'get_tag_keys');
  }

  getTagValues(options) {
    return this.getTerms({ field: options.key, query: '*' }, 'get_tag_values');
  }

  targetContainsTemplate(target) {
    if (this.templateSrv.variableExists(target.query) || this.templateSrv.variableExists(target.alias)) {
      return true;
    }

    for (const bucketAgg of target.bucketAggs) {
      if (this.templateSrv.variableExists(bucketAgg.field) || this.objectContainsTemplate(bucketAgg.settings)) {
        return true;
      }
    }

    for (const metric of target.metrics) {
      if (
        this.templateSrv.variableExists(metric.field) ||
        this.objectContainsTemplate(metric.settings) ||
        this.objectContainsTemplate(metric.meta)
      ) {
        return true;
      }
    }

    return false;
  }

  private isPrimitive(obj) {
    if (obj === null || obj === undefined) {
      return true;
    }
    if (['string', 'number', 'boolean'].some(type => type === typeof true)) {
      return true;
    }

    return false;
  }

  private objectContainsTemplate(obj) {
    if (!obj) {
      return false;
    }

    for (const key of Object.keys(obj)) {
      if (this.isPrimitive(obj[key])) {
        if (this.templateSrv.variableExists(obj[key])) {
          return true;
        }
      } else if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          if (this.objectContainsTemplate(item)) {
            return true;
          }
        }
      } else {
        if (this.objectContainsTemplate(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }
}
