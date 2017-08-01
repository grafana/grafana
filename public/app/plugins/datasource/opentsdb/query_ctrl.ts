///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {QueryCtrl} from 'app/plugins/sdk';

export class OpenTsQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  aggregators: any;
  fillPolicies: any;
  filterTypes: any;
  queryTypes: any;
  tsdbVersion: any;
  aggregator: any;
  downsampleInterval: any;
  downsampleAggregator: any;
  downsampleFillPolicy: any;
  downsampleFillValue: any;
  joinOperators: any;
  errors: any;
  suggestMetrics: any;
  suggestTagKeys: any;
  suggestTagValues: any;
  addTagMode: boolean;
  addFilterMode: boolean;

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    this.errors = this.validateTarget();
    this.aggregators = ['avg', 'sum', 'min', 'max', 'dev', 'zimsum', 'mimmin', 'mimmax'];
    this.fillPolicies = ['none', 'nan', 'null', 'zero', 'scalar'];
    this.filterTypes = ['wildcard','iliteral_or','not_iliteral_or','not_literal_or','iwildcard','literal_or','regexp'];
    this.joinOperators = ['union', 'intersection'];
    this.queryTypes = ['metric','exp'];

    this.tsdbVersion = this.datasource.tsdbVersion;

    if (!this.target.queryType) {
      this.target.queryType = 'metric';
    }

    if (!this.target.aggregator) {
      this.target.aggregator = 'sum';
    }

    if (!this.target.downsampleAggregator) {
      this.target.downsampleAggregator = 'avg';
    }

    if (!this.target.downsampleFillPolicy) {
      this.target.downsampleFillPolicy = 'none';
    }

    if (!this.target.downsampleFillValue) {
      this.target.downsampleFillValue = NaN;
    }

  	if (!this.target.expFillPolicy){
    	this.target.expFillPolicy = 'none';
  	}
  	
  	if (!this.target.expFillValue){
    	this.target.expFillValue = NaN;
  	}

    if (!this.target.join) {
      this.target.join = {
        operator: 'union',
        useQueryTags: false,
        includeAggTags: true
      };
    }

    this.datasource.getAggregators().then((aggs) => {
      if (aggs.length !== 0) {
        this.aggregators = aggs;
      }
    });

    this.datasource.getFilterTypes().then((filterTypes) => {
      if (filterTypes.length !== 0) {
        this.filterTypes = filterTypes;
      }
    });

    // needs to be defined here as it is called from typeahead
    this.suggestMetrics = (query, callback) => {
      this.datasource.metricFindQuery('metrics(' + query + ')')
      .then(this.getTextValues)
      .then(callback);
    };

    this.suggestTagKeys = (query, callback) => {
      this.datasource.suggestTagKeys(this.target.metric).then(callback);
    };

    this.suggestTagValues = (query, callback) => {
      this.datasource.metricFindQuery('suggest_tagv(' + query + ')')
      .then(this.getTextValues)
      .then(callback);
    };
  }

  targetBlur() {
    this.errors = this.validateTarget();
    this.refresh();
  }

  getTextValues(metricFindResult) {
    return _.map(metricFindResult, function(value) { return value.text; });
  }

  addTag() {

    if (this.target.filters && this.target.filters.length > 0) {
      this.errors.tags = "Please remove filters to use tags, tags and filters are mutually exclusive.";
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

  removeTag(key) {
    delete this.target.tags[key];
    this.targetBlur();
  }

  editTag(key, value) {
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
      this.errors.filters = "Please remove tags to use filters, tags and filters are mutually exclusive.";
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
      var currentFilter = {
        type:    this.target.currentFilterType,
        tagk:     this.target.currentFilterKey,
        filter:   this.target.currentFilterValue,
        groupBy: this.target.currentFilterGroupBy
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

  removeFilter(index) {
    this.target.filters.splice(index, 1);
    this.targetBlur();
  }

  editFilter(fil, index) {
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
    var errs: any = {};

    if (this.target.shouldDownsample) {
      try {
        if (this.target.downsampleInterval) {
          kbn.describe_interval(this.target.downsampleInterval);
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

  getCollapsedText() {
    var text = '';
    if (this.target.queryType === 'metric' && this.target.metric) {
      text = 'Metric: ' + this.target.aggregator + ':';
      if (this.target.shouldComputeRate) {
        text += 'rate';
        if (this.target.isCounter) {
          text += '{dropcounter';
          if (this.target.counterMax && this.target.counterMax.length) {
            text += ',' + parseInt(this.target.counterMax);
          }
          if (this.target.counterResetValue && this.target.counterResetValue.length) {
            text += ',' + parseInt(this.target.counterResetValue);
          }
          text += '}';
        }
        text += ':';
      }
      if (!this.target.disableDownsampling && this.target.downsampleInterval.length) {
        text += this.target.downsampleInterval + '-' + this.target.downsampleAggregator + '-' + this.target.downsampleFillPolicy + ':';
      }
      text += this.target.metric;
      if (_.size(this.target.tags) > 0) {
        var tags = [];
        _.each(this.target.tags, function(tagV, tagK) {
          tags.push(tagK + '=' + tagV);
        });
        if (tags.length >0) {
          text += '{' + tags.join(',') + '}';
        }
      } else if (_.size(this.target.filters) > 0){
        var nonGroupFilters = [];
        var groupFilters = [];

        //get filters with groupBy true
        _.each(_.filter(this.target.filters, function(f) {return f.groupBy;}), function(filter) {
          groupFilters.push(filter.tagk + '=' + filter.type + '(' + filter.filter + ')');
        });

        //get filters with groupBy false
        _.each(_.filter(this.target.filters, function(f) {return !f.groupBy;}), function(filter) {
          nonGroupFilters.push(filter.tagk + '=' + filter.type + '(' + filter.filter + ')');
        });

        if (groupFilters.length > 0 || nonGroupFilters.length > 0) {
          text += '{' + groupFilters.join(',') + '}';
        }

        if (nonGroupFilters.length > 0) {
          text += '{' + nonGroupFilters.join(',') + '}';
        }
      }
    } else if (this.target.queryType === 'exp' && this.target.exp) {
      text += 'Expression: ' + this.target.exp;
    } else {
      text = 'No metric or expression';
    }
    return text;
  }
}
