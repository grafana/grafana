define([
  'angular',
  'lodash',
  'app/plugins/sdk'
],
function (angular, _, sdk) {
  'use strict';

  return (function (_super) {
    var self;

    /** @ngInject */
    function KairosDBQueryCtrl($scope, $injector, $timeout) {
      _super.call(this, $scope, $injector);

      this.$timeout = $timeout;
      if (!this.target.downsampling) {
        this.target.downsampling = 'avg';
      }
      if (!this.target.downsampling) {
        this.target.downsampling = this.target.downsampling;
        this.target.sampling = this.target.sampling;
      }
      if (!this.target.aliasMode) {
        this.target.aliasMode = 'default';
        this.target.alias = this.datasource.getDefaultAlias(this.target);
      }
      this.target.errors = validateTarget(this.target);

      this.metricNamesCallDelay = 1000;
      this.metricNamesPromise = null;
      this.lastSuggestedMetricName = null;

      self = this;
    }

    KairosDBQueryCtrl.prototype = Object.create(_super.prototype);
    KairosDBQueryCtrl.prototype.constructor = KairosDBQueryCtrl;

    KairosDBQueryCtrl.templateUrl = 'partials/query.editor.html';

    KairosDBQueryCtrl.prototype.targetBlur = function () {
      this.target.errors = validateTarget(this.target);
      if (this.target.aliasMode === 'default') {
        this.target.alias = this.datasource.getDefaultAlias(this.target);
      }
      if (!_.isEqual(this.oldTarget, this.target) && _.isEmpty(this.target.errors)) {
        this.oldTarget = angular.copy(this.target);
        this.panelCtrl.refresh();
      }
    };

    KairosDBQueryCtrl.prototype.getTextValues = function (metricFindResult) {
      return _.map(metricFindResult, function (value) {
        return value.text;
      });
    };

    KairosDBQueryCtrl.prototype.suggestMetrics = function (query, callback) {
      if (self.lastSuggestedMetricName === query) { return; }
      self.lastSuggestedMetricName = query;
      self.$timeout.cancel(self.metricNamesPromise);
      self.metricNamesPromise = self.$timeout(
          function() {
            return self.datasource.metricFindQuery('metrics(' + query + ')')
                .then(self.getTextValues)
                .then(callback);
          }, self.metricNamesCallDelay);
    };

    KairosDBQueryCtrl.prototype.suggestTagKeys = function (query, callback) {
      self.datasource.metricFindQuery('tag_names(' + self.target.metric + ')')
        .then(self.getTextValues)
        .then(callback);
    };

    KairosDBQueryCtrl.prototype.suggestTagValues = function (query, callback) {
      self.datasource.metricFindQuery('tag_values(' + self.target.metric + ',' + self.target.currentTagKey + ')')
        .then(self.getTextValues)
        .then(callback);
    };

    // Filter metric by tag
    KairosDBQueryCtrl.prototype.addFilterTag = function () {
      if (!this.target.addFilterTagMode) {
        this.target.addFilterTagMode = true;
        this.validateFilterTag();
        return;
      }

      if (!this.target.tags) {
        this.target.tags = {};
      }

      this.validateFilterTag();
      if (!this.target.errors.tags) {
        if (!_.has(this.target.tags, this.target.currentTagKey)) {
          this.target.tags[this.target.currentTagKey] = [];
        }
        this.target.tags[this.target.currentTagKey].push(this.target.currentTagValue);
        this.target.currentTagKey = '';
        this.target.currentTagValue = '';
        this.targetBlur();
      }

      this.target.addFilterTagMode = false;
    };

    KairosDBQueryCtrl.prototype.removeFilterTag = function (key) {
      delete this.target.tags[key];
      if (_.size(this.target.tags) === 0) {
        this.target.tags = null;
      }
      this.targetBlur();
    };

    KairosDBQueryCtrl.prototype.validateFilterTag = function () {
      this.target.errors.tags = null;
      if (!this.target.currentTagKey || !this.target.currentTagValue) {
        this.target.errors.tags = "You must specify a tag name and value.";
      }
    };

    //////////////////////////////
    // GROUP BY
    //////////////////////////////
    KairosDBQueryCtrl.prototype.addGroupBy = function () {
      if (!this.target.addGroupByMode) {
        this.target.currentGroupByType = 'tag';
        this.target.addGroupByMode = true;
        this.target.isTagGroupBy = true;
        this.validateGroupBy();
        return;
      }
      this.validateGroupBy();
      // nb: if error is found, means that user clicked on cross : cancels input

      if (_.isEmpty(this.target.errors.groupBy)) {
        if (this.target.isTagGroupBy) {
          if (!this.target.groupByTags) {
            this.target.groupByTags = [];
          }
          if (!_.includes(this.target.groupByTags, this.target.groupBy.tagKey)) {
            this.target.groupByTags.push(this.target.groupBy.tagKey);
            this.targetBlur();
          }
          this.target.groupBy.tagKey = '';
        }
        else {
          if (!this.target.nonTagGroupBys) {
            this.target.nonTagGroupBys = [];
          }
          var groupBy = {
            name: this.target.currentGroupByType
          };
          if (this.target.isValueGroupBy) {
            groupBy.range_size = this.target.groupBy.valueRange;
          } else if (this.target.isTimeGroupBy) {
            groupBy.range_size = this.target.groupBy.timeInterval;
            groupBy.group_count = this.target.groupBy.groupCount;
          }
          this.target.nonTagGroupBys.push(groupBy);
        }
        this.targetBlur();
      }

      this.target.isTagGroupBy = false;
      this.target.isValueGroupBy = false;
      this.target.isTimeGroupBy = false;
      this.target.addGroupByMode = false;
    };

    KairosDBQueryCtrl.prototype.removeGroupByTag = function (index) {
      this.target.groupByTags.splice(index, 1);
      if (_.size(this.target.groupByTags) === 0) {
        this.target.groupByTags = null;
      }
      this.targetBlur();
    };

    KairosDBQueryCtrl.prototype.removeNonTagGroupBy = function (index) {
      this.target.nonTagGroupBys.splice(index, 1);
      if (_.size(this.target.nonTagGroupBys) === 0) {
        this.target.nonTagGroupBys = null;
      }
      this.targetBlur();
    };

    KairosDBQueryCtrl.prototype.changeGroupByInput = function () {
      this.target.isTagGroupBy = this.target.currentGroupByType === 'tag';
      this.target.isValueGroupBy = this.target.currentGroupByType === 'value';
      this.target.isTimeGroupBy = this.target.currentGroupByType === 'time';
      this.validateGroupBy();
    };

    KairosDBQueryCtrl.prototype.getValuesOfGroupBy = function (groupBy) {
      return _.values(groupBy);
    };

    KairosDBQueryCtrl.prototype.validateGroupBy = function () {
      delete this.target.errors.groupBy;
      var errors = {};
      this.target.isGroupByValid = true;
      if (this.target.isTagGroupBy) {
        if (!this.target.groupBy.tagKey) {
          this.target.isGroupByValid = false;
          errors.tagKey = 'You must supply a tag name';
        }
      }

      if (this.target.isValueGroupBy) {
        if (!this.target.groupBy.valueRange || !isInt(this.target.groupBy.valueRange)) {
          errors.valueRange = "Range must be an integer";
          this.isGroupByValid = false;
        }
      }

      if (this.target.isTimeGroupBy) {
        try {
          this.datasource.convertToKairosInterval(this.target.groupBy.timeInterval);
        } catch (err) {
          errors.timeInterval = err.message;
          this.isGroupByValid = false;
        }
        if (!this.target.groupBy.groupCount || !isInt(this.target.groupBy.groupCount)) {
          errors.groupCount = "Group count must be an integer";
          this.isGroupByValid = false;
        }
      }

      if (!_.isEmpty(errors)) {
        this.target.errors.groupBy = errors;
      }
    };

    function isInt(n) {
      return parseInt(n) % 1 === 0;
    }

    //////////////////////////////
    // HORIZONTAL AGGREGATION
    //////////////////////////////

    KairosDBQueryCtrl.prototype.addHorizontalAggregator = function () {
      if (!this.target.addHorizontalAggregatorMode) {
        this.target.addHorizontalAggregatorMode = true;
        this.target.currentHorizontalAggregatorName = 'avg';
        this.target.hasSamplingRate = true;
        this.validateHorizontalAggregator();
        return;
      }

      this.validateHorizontalAggregator();
      // nb: if error is found, means that user clicked on cross : cancels input
      if (_.isEmpty(this.target.errors.horAggregator)) {
        if (!this.target.horizontalAggregators) {
          this.target.horizontalAggregators = [];
        }
        var aggregator = {
          name: this.target.currentHorizontalAggregatorName
        };
        if (this.target.hasSamplingRate) {
          aggregator.sampling_rate = this.target.horAggregator.samplingRate ? this.target.horAggregator.samplingRate:"auto";
        }
        if (this.target.hasUnit) {
          aggregator.unit = this.target.horAggregator.unit;
        }
        if (this.target.hasFactor) {
          aggregator.factor = this.target.horAggregator.factor;
        }
        if (this.target.hasNothing) {
          aggregator.nothing = this.target.horAggregator.nothing;
        }
        if (this.target.hasPercentile) {
          aggregator.percentile = this.target.horAggregator.percentile;
        }
        this.target.horizontalAggregators.push(aggregator);
        this.targetBlur();
      }

      this.target.addHorizontalAggregatorMode = false;
      this.target.hasSamplingRate = false;
      this.target.hasUnit = false;
      this.target.hasFactor = false;
      this.target.hasNothing = false;
      this.target.hasPercentile = false;
      this.target.hasTrim = false;
    };

    KairosDBQueryCtrl.prototype.removeHorizontalAggregator = function (index) {
      this.target.horizontalAggregators.splice(index, 1);
      if (_.size(this.target.horizontalAggregators) === 0) {
        this.target.horizontalAggregators = null;
      }

      this.targetBlur();
    };

    KairosDBQueryCtrl.prototype.changeHorAggregationInput = function() {
      this.target.hasSamplingRate = _.includes(
          ['avg','dev','max','min','sum','least_squares','count','percentile', 'first', 'gaps', 'last'],
          this.target.currentHorizontalAggregatorName);
      this.target.hasUnit = _.includes(['sampler','rate'], this.target.currentHorizontalAggregatorName);
      this.target.hasFactor = _.includes(['div','scale'], this.target.currentHorizontalAggregatorName);

      this.target.hasNothing = _.includes(['diff'], this.target.currentHorizontalAggregatorName);
      this.target.hasPercentile = 'percentile' === this.target.currentHorizontalAggregatorName;
      this.target.hasTrim = _.includes(['trim'], this.target.currentHorizontalAggregatorName);
      this.validateHorizontalAggregator();
    };

    KairosDBQueryCtrl.prototype.validateHorizontalAggregator = function () {
      delete this.target.errors.horAggregator;
      var errors = {};
      this.target.isAggregatorValid = true;

      if (this.target.hasSamplingRate && this.target.horAggregator.samplingRate) {
        try {
          this.datasource.convertToKairosInterval(this.target.horAggregator.samplingRate);
        } catch (err) {
          errors.samplingRate = err.message;
          this.target.isAggregatorValid = false;
        }
      }

      if (this.hasFactor) {
        if (!this.target.horAggregator.factor) {
          errors.factor = 'You must supply a numeric value for this aggregator';
          this.target.isAggregatorValid = false;
        }
        else if (parseInt(this.target.horAggregator.factor) === 0 && this.target.currentHorizontalAggregatorName === 'div') {
          errors.factor = 'Cannot divide by 0';
          this.target.isAggregatorValid = false;
        }
      }

      if (this.target.hasPercentile) {
        if (!this.target.horAggregator.percentile ||
          this.target.horAggregator.percentile<=0 ||
          this.target.horAggregator.percentile>1) {
          errors.percentile = 'Percentile must be between 0 and 1';
          this.target.isAggregatorValid = false;
        }
      }

      if (this.target.hasTrim) {
        if (!this.target.horAggregator.trim ||
          (this.target.horAggregator.trim !== 'both' &&
          this.target.horAggregator.trim !== 'first' &&
          this.target.horAggregator.trim !== 'last')) {
          errors.trim = 'Trim must be of value both, first, or last';
          this.target.isAggregatorValid = false;
        }
      }

      if (!_.isEmpty(errors)) {
        this.target.errors.horAggregator = errors;
      }
    };

    KairosDBQueryCtrl.prototype.alert = function (message) {
      alert(message);
    };

    // Validation
    function validateTarget(target) {
      var errs = {};

      if (!target.metric) {
        errs.metric = "You must supply a metric name.";
      }

      try {
        if (target.sampling) {
          self.datasource.convertToKairosInterval(target.sampling);
        }
      } catch (err) {
        errs.sampling = err.message;
      }

      return errs;
    }

    return {
      KairosDBQueryCtrl: KairosDBQueryCtrl
    };

  })(sdk.QueryCtrl);
});
