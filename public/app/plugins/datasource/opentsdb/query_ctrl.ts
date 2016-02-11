///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {QueryCtrl} from 'app/plugins/sdk';

export class OpenTsQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  aggregators: any;
  fillPolicies: any;
  aggregator: any;
  downsampleInterval: any;
  downsampleAggregator: any;
  downsampleFillPolicy: any;
  errors: any;
  suggestMetrics: any;
  suggestTagKeys: any;
  suggestTagValues: any;
  addTagMode: boolean;

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    this.errors = this.validateTarget();
    this.aggregators = ['avg', 'sum', 'min', 'max', 'dev', 'zimsum', 'mimmin', 'mimmax'];
    this.fillPolicies = ['none', 'nan', 'null', 'zero'];

    if (!this.target.aggregator) {
      this.target.aggregator = 'sum';
    }

    if (!this.target.downsampleAggregator) {
      this.target.downsampleAggregator = 'avg';
    }

    if (!this.target.downsampleFillPolicy) {
      this.target.downsampleFillPolicy = 'none';
    }

    this.datasource.getAggregators().then(function(aggs) {
      this.aggregators = aggs;
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
}
