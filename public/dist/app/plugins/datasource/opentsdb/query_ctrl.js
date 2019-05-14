import * as tslib_1 from "tslib";
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import { QueryCtrl } from 'app/plugins/sdk';
var OpenTsQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(OpenTsQueryCtrl, _super);
    /** @ngInject */
    function OpenTsQueryCtrl($scope, $injector) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.errors = _this.validateTarget();
        _this.aggregators = ['avg', 'sum', 'min', 'max', 'dev', 'zimsum', 'mimmin', 'mimmax'];
        _this.fillPolicies = ['none', 'nan', 'null', 'zero'];
        _this.filterTypes = [
            'wildcard',
            'iliteral_or',
            'not_iliteral_or',
            'not_literal_or',
            'iwildcard',
            'literal_or',
            'regexp',
        ];
        _this.tsdbVersion = _this.datasource.tsdbVersion;
        if (!_this.target.aggregator) {
            _this.target.aggregator = 'sum';
        }
        if (!_this.target.downsampleAggregator) {
            _this.target.downsampleAggregator = 'avg';
        }
        if (!_this.target.downsampleFillPolicy) {
            _this.target.downsampleFillPolicy = 'none';
        }
        _this.datasource.getAggregators().then(function (aggs) {
            if (aggs.length !== 0) {
                _this.aggregators = aggs;
            }
        });
        _this.datasource.getFilterTypes().then(function (filterTypes) {
            if (filterTypes.length !== 0) {
                _this.filterTypes = filterTypes;
            }
        });
        // needs to be defined here as it is called from typeahead
        _this.suggestMetrics = function (query, callback) {
            _this.datasource
                .metricFindQuery('metrics(' + query + ')')
                .then(_this.getTextValues)
                .then(callback);
        };
        _this.suggestTagKeys = function (query, callback) {
            _this.datasource.suggestTagKeys(_this.target.metric).then(callback);
        };
        _this.suggestTagValues = function (query, callback) {
            _this.datasource
                .metricFindQuery('suggest_tagv(' + query + ')')
                .then(_this.getTextValues)
                .then(callback);
        };
        return _this;
    }
    OpenTsQueryCtrl.prototype.targetBlur = function () {
        this.errors = this.validateTarget();
        this.refresh();
    };
    OpenTsQueryCtrl.prototype.getTextValues = function (metricFindResult) {
        return _.map(metricFindResult, function (value) {
            return value.text;
        });
    };
    OpenTsQueryCtrl.prototype.addTag = function () {
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
    };
    OpenTsQueryCtrl.prototype.removeTag = function (key) {
        delete this.target.tags[key];
        this.targetBlur();
    };
    OpenTsQueryCtrl.prototype.editTag = function (key, value) {
        this.removeTag(key);
        this.target.currentTagKey = key;
        this.target.currentTagValue = value;
        this.addTag();
    };
    OpenTsQueryCtrl.prototype.closeAddTagMode = function () {
        this.addTagMode = false;
        return;
    };
    OpenTsQueryCtrl.prototype.addFilter = function () {
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
            var currentFilter = {
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
    };
    OpenTsQueryCtrl.prototype.removeFilter = function (index) {
        this.target.filters.splice(index, 1);
        this.targetBlur();
    };
    OpenTsQueryCtrl.prototype.editFilter = function (fil, index) {
        this.removeFilter(index);
        this.target.currentFilterKey = fil.tagk;
        this.target.currentFilterValue = fil.filter;
        this.target.currentFilterType = fil.type;
        this.target.currentFilterGroupBy = fil.groupBy;
        this.addFilter();
    };
    OpenTsQueryCtrl.prototype.closeAddFilterMode = function () {
        this.addFilterMode = false;
        return;
    };
    OpenTsQueryCtrl.prototype.validateTarget = function () {
        var errs = {};
        if (this.target.shouldDownsample) {
            try {
                if (this.target.downsampleInterval) {
                    kbn.describe_interval(this.target.downsampleInterval);
                }
                else {
                    errs.downsampleInterval = "You must supply a downsample interval (e.g. '1m' or '1h').";
                }
            }
            catch (err) {
                errs.downsampleInterval = err.message;
            }
        }
        if (this.target.tags && _.has(this.target.tags, this.target.currentTagKey)) {
            errs.tags = "Duplicate tag key '" + this.target.currentTagKey + "'.";
        }
        return errs;
    };
    OpenTsQueryCtrl.templateUrl = 'partials/query.editor.html';
    return OpenTsQueryCtrl;
}(QueryCtrl));
export { OpenTsQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map