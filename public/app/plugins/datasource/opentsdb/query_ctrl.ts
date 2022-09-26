import { auto } from 'angular';
import { map, size, has } from 'lodash';

import { textUtil, rangeUtil } from '@grafana/data';
import { QueryCtrl } from 'app/plugins/sdk';

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
  addTagMode = false;
  addFilterMode = false;

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService) {
    super($scope, $injector);

    // X moved to OpenTsdbQueryEditor
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
    // X moved to OpenTsdbQueryEditor
    this.tsdbVersion = this.datasource.tsdbVersion;
    // X moved to OpenTsdbQueryEditor
    if (!this.target.aggregator) {
      this.target.aggregator = 'sum';
    }
    // X moved to OpenTsdbQueryEditor
    if (!this.target.downsampleAggregator) {
      this.target.downsampleAggregator = 'avg';
    }
    // X moved to OpenTsdbQueryEditor
    if (!this.target.downsampleFillPolicy) {
      this.target.downsampleFillPolicy = 'none';
    }

    // X moved to OpenTsdbQueryEditor
    this.datasource.getAggregators().then((aggs: { length: number }) => {
      if (aggs.length !== 0) {
        this.aggregators = aggs;
      }
    });

    // X moved to OpenTsdbQueryEditor
    this.datasource.getFilterTypes().then((filterTypes: { length: number }) => {
      if (filterTypes.length !== 0) {
        this.filterTypes = filterTypes;
      }
    });

    // X moved to OpenTsdbQueryEditor
    // needs to be defined here as it is called from typeahead
    this.suggestMetrics = (query: string, callback: any) => {
      this.datasource
        .metricFindQuery('metrics(' + query + ')')
        .then(this.getTextValues)
        .then(callback);
    };

    // X move to OpenTsdbQueryEditor
    this.suggestTagKeys = (query: any, callback: any) => {
      this.datasource.suggestTagKeys(this.target.metric).then(callback);
    };

    // X move to OpenTsdbQueryEditor
    this.suggestTagValues = (query: string, callback: any) => {
      this.datasource
        .metricFindQuery('suggest_tagv(' + query + ')')
        .then(this.getTextValues)
        .then(callback);
    };
  }

  // consider refactoring, updating behavior
  // for example, flipping a switch when adding filters runs the query before the filter is even added to the query
  targetBlur() {
    this.errors = this.validateTarget();
    this.refresh();
  }

  // X moved to OpenTsdbQueryEditor
  getTextValues(metricFindResult: any) {
    return map(metricFindResult, (value) => {
      return textUtil.escapeHtml(value.text);
    });
  }

  // X moved to tag section
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

  // X moved to tag section
  removeTag(key: string | number) {
    delete this.target.tags[key];
    this.targetBlur();
  }

  // X moved to tag section
  editTag(key: string | number, value: any) {
    this.removeTag(key);
    this.target.currentTagKey = key;
    this.target.currentTagValue = value;
    this.addTag();
  }

  // X moved to tag section
  closeAddTagMode() {
    this.addTagMode = false;
    return;
  }

  // X moved to FilterSection
  addFilter() {
    if (this.target.tags && size(this.target.tags) > 0) {
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

  // X moved to FilterSection
  removeFilter(index: number) {
    this.target.filters.splice(index, 1);
    this.targetBlur();
  }

  // X moved to FilterSection
  editFilter(fil: { tagk: any; filter: any; type: any; groupBy: any }, index: number) {
    this.removeFilter(index);
    this.target.currentFilterKey = fil.tagk;
    this.target.currentFilterValue = fil.filter;
    this.target.currentFilterType = fil.type;
    this.target.currentFilterGroupBy = fil.groupBy;
    this.addFilter();
  }

  // X moved to FilterSection
  closeAddFilterMode() {
    this.addFilterMode = false;
    return;
  }

  // Possible refactor
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
        if (err instanceof Error) {
          errs.downsampleInterval = err.message;
        }
      }
    }

    if (this.target.tags && has(this.target.tags, this.target.currentTagKey)) {
      errs.tags = "Duplicate tag key '" + this.target.currentTagKey + "'.";
    }

    return errs;
  }
}
