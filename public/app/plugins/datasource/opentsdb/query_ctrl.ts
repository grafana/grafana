import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';
import { textUtil, rangeUtil } from '@grafana/data';

export class OpenTsQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  aggregators: any;
  fillPolicies: any;
  filterTypes: any;
  tsdbVersion: any;
  aggregator: any;
  downsampleInterval: any;
  downsampleAggregator: any;
  downsampleFillPolicy: any;
  errors: any;
  suggestMetrics: any;
  suggestTagKeys: any;
  suggestTagValues: any;
  addTagMode: boolean;
  addFilterMode: boolean;

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService) {
    super($scope, $injector);

    this.errors = this.validateTarget();
    this.aggregators = ['avg', 'sum', 'min', 'max', 'dev', 'zimsum', 'mimmin', 'mimmax'];
    this.fillPolicies = ['none', 'nan', 'null', 'zero'];
    this.filterTypes = [
      'wildcard',
      'iliteral_or',
      'not_iliteral_or',
      'not_literal_or',
      'iwildcard',
      'literal_or',
      'regexp',
    ];

    this.tsdbVersion = this.datasource.tsdbVersion;

    if (!this.target.aggregator) {
      this.target.aggregator = 'sum';
    }

    if (!this.target.downsampleAggregator) {
      this.target.downsampleAggregator = 'avg';
    }

    if (!this.target.downsampleFillPolicy) {
      this.target.downsampleFillPolicy = 'none';
    }

    this.datasource.getAggregators().then((aggs: { length: number }) => {
      if (aggs.length !== 0) {
        this.aggregators = aggs;
      }
    });

    this.datasource.getFilterTypes().then((filterTypes: { length: number }) => {
      if (filterTypes.length !== 0) {
        this.filterTypes = filterTypes;
      }
    });

    // needs to be defined here as it is called from typeahead
    this.suggestMetrics = (query: string, callback: any) => {
      this.datasource
        .metricFindQuery('metrics(' + query + ')')
        .then(this.getTextValues)
        .then(callback);
    };

    this.suggestTagKeys = (query: any, callback: any) => {
      this.datasource.suggestTagKeys(this.target.metric).then(callback);
    };

    this.suggestTagValues = (query: string, callback: any) => {
      this.datasource
        .metricFindQuery('suggest_tagv(' + query + ')')
        .then(this.getTextValues)
        .then(callback);
    };
  }

  targetBlur() {
    this.errors = this.validateTarget();
    this.refresh();
  }

  getTextValues(metricFindResult: any) {
    return _.map(metricFindResult, value => {
      return textUtil.escapeHtml(value.text);
    });
  }

  addTag() {
    if (this.target.filters && this.target.filters.length > 0) {
      this.errors.tags = 'Please remove filters to use tags, tags and filters are mutually exclusive.';
    }

    if (!this.addTagMode) {
      this.addTagMode = true;
      return;
    }

    if (!this.target.tags) {
      this.target.tags = {};
    }

    this.errors = this.validateTarget();

    if (!this.errors.tags) {
      this.target.tags[this.target.currentTagKey] = this.target.currentTagValue;
      this.target.currentTagKey = '';
      this.target.currentTagValue = '';
      this.targetBlur();
    }

    this.addTagMode = false;
  }

  removeTag(key: string | number) {
    delete this.target.tags[key];
    this.targetBlur();
  }

  editTag(key: string | number, value: any) {
    this.removeTag(key);
    this.target.currentTagKey = key;
    this.target.currentTagValue = value;
    this.addTag();
  }

  closeAddTagMode() {
    this.addTagMode = false;
    return;
  }

  addFilter() {
    if (this.target.tags && _.size(this.target.tags) > 0) {
      this.errors.filters = 'Please remove tags to use filters, tags and filters are mutually exclusive.';
    }

    if (!this.addFilterMode) {
      this.addFilterMode = true;
      return;
    }

    if (!this.target.filters) {
      this.target.filters = [];
    }

    if (!this.target.currentFilterType) {
      this.target.currentFilterType = 'iliteral_or';
    }

    if (!this.target.currentFilterGroupBy) {
      this.target.currentFilterGroupBy = false;
    }

    this.errors = this.validateTarget();

    if (!this.errors.filters) {
      const currentFilter = {
        type: this.target.currentFilterType,
        tagk: this.target.currentFilterKey,
        filter: this.target.currentFilterValue,
        groupBy: this.target.currentFilterGroupBy,
      };
      this.target.filters.push(currentFilter);
      this.target.currentFilterType = 'literal_or';
      this.target.currentFilterKey = '';
      this.target.currentFilterValue = '';
      this.target.currentFilterGroupBy = false;
      this.targetBlur();
    }

    this.addFilterMode = false;
  }

  removeFilter(index: number) {
    this.target.filters.splice(index, 1);
    this.targetBlur();
  }

  editFilter(fil: { tagk: any; filter: any; type: any; groupBy: any }, index: number) {
    this.removeFilter(index);
    this.target.currentFilterKey = fil.tagk;
    this.target.currentFilterValue = fil.filter;
    this.target.currentFilterType = fil.type;
    this.target.currentFilterGroupBy = fil.groupBy;
    this.addFilter();
  }

  closeAddFilterMode() {
    this.addFilterMode = false;
    return;
  }

  validateTarget() {
    const errs: any = {};

    if (this.target.shouldDownsample) {
      try {
        if (this.target.downsampleInterval) {
          rangeUtil.describeInterval(this.target.downsampleInterval);
        } else {
          errs.downsampleInterval = "You must supply a downsample interval (e.g. '1m' or '1h').";
        }
      } catch (err) {
        errs.downsampleInterval = err.message;
      }
    }

    if (this.target.tags && _.has(this.target.tags, this.target.currentTagKey)) {
      errs.tags = "Duplicate tag key '" + this.target.currentTagKey + "'.";
    }

    return errs;
  }
}
