import _ from 'lodash';
import { containsVariable, assignModelProperties, variableTypes } from './variable';
import { stringToJsRegex } from '@grafana/ui';
function getNoneOption() {
    return { text: 'None', value: '', isNone: true };
}
var QueryVariable = /** @class */ (function () {
    /** @ngInject */
    function QueryVariable(model, datasourceSrv, templateSrv, variableSrv, timeSrv) {
        this.model = model;
        this.datasourceSrv = datasourceSrv;
        this.templateSrv = templateSrv;
        this.variableSrv = variableSrv;
        this.timeSrv = timeSrv;
        this.defaults = {
            type: 'query',
            label: null,
            query: '',
            regex: '',
            sort: 0,
            datasource: null,
            refresh: 0,
            hide: 0,
            name: '',
            multi: false,
            includeAll: false,
            allValue: null,
            options: [],
            current: {},
            tags: [],
            useTags: false,
            tagsQuery: '',
            tagValuesQuery: '',
            skipUrlSync: false,
            definition: '',
        };
        // copy model properties to this instance
        assignModelProperties(this, model, this.defaults);
    }
    QueryVariable.prototype.getSaveModel = function () {
        // copy back model properties to model
        assignModelProperties(this.model, this, this.defaults);
        // remove options
        if (this.refresh !== 0) {
            this.model.options = [];
        }
        return this.model;
    };
    QueryVariable.prototype.setValue = function (option) {
        return this.variableSrv.setOptionAsCurrent(this, option);
    };
    QueryVariable.prototype.setValueFromUrl = function (urlValue) {
        return this.variableSrv.setOptionFromUrl(this, urlValue);
    };
    QueryVariable.prototype.getValueForUrl = function () {
        if (this.current.text === 'All') {
            return 'All';
        }
        return this.current.value;
    };
    QueryVariable.prototype.updateOptions = function () {
        return this.datasourceSrv
            .get(this.datasource)
            .then(this.updateOptionsFromMetricFindQuery.bind(this))
            .then(this.updateTags.bind(this))
            .then(this.variableSrv.validateVariableSelectionState.bind(this.variableSrv, this));
    };
    QueryVariable.prototype.updateTags = function (datasource) {
        var _this = this;
        if (this.useTags) {
            return this.metricFindQuery(datasource, this.tagsQuery).then(function (results) {
                _this.tags = [];
                for (var i = 0; i < results.length; i++) {
                    _this.tags.push(results[i].text);
                }
                return datasource;
            });
        }
        else {
            delete this.tags;
        }
        return datasource;
    };
    QueryVariable.prototype.getValuesForTag = function (tagKey) {
        var _this = this;
        return this.datasourceSrv.get(this.datasource).then(function (datasource) {
            var query = _this.tagValuesQuery.replace('$tag', tagKey);
            return _this.metricFindQuery(datasource, query).then(function (results) {
                return _.map(results, function (value) {
                    return value.text;
                });
            });
        });
    };
    QueryVariable.prototype.updateOptionsFromMetricFindQuery = function (datasource) {
        var _this = this;
        return this.metricFindQuery(datasource, this.query).then(function (results) {
            _this.options = _this.metricNamesToVariableValues(results);
            if (_this.includeAll) {
                _this.addAllOption();
            }
            if (!_this.options.length) {
                _this.options.push(getNoneOption());
            }
            return datasource;
        });
    };
    QueryVariable.prototype.metricFindQuery = function (datasource, query) {
        var options = { range: undefined, variable: this };
        if (this.refresh === 2) {
            options.range = this.timeSrv.timeRange();
        }
        return datasource.metricFindQuery(query, options);
    };
    QueryVariable.prototype.addAllOption = function () {
        this.options.unshift({ text: 'All', value: '$__all' });
    };
    QueryVariable.prototype.metricNamesToVariableValues = function (metricNames) {
        var regex, options, i, matches;
        options = [];
        if (this.regex) {
            regex = stringToJsRegex(this.templateSrv.replace(this.regex, {}, 'regex'));
        }
        for (i = 0; i < metricNames.length; i++) {
            var item = metricNames[i];
            var text = item.text === undefined || item.text === null ? item.value : item.text;
            var value = item.value === undefined || item.value === null ? item.text : item.value;
            if (_.isNumber(value)) {
                value = value.toString();
            }
            if (_.isNumber(text)) {
                text = text.toString();
            }
            if (regex) {
                matches = regex.exec(value);
                if (!matches) {
                    continue;
                }
                if (matches.length > 1) {
                    value = matches[1];
                    text = matches[1];
                }
            }
            options.push({ text: text, value: value });
        }
        options = _.uniqBy(options, 'value');
        return this.sortVariableValues(options, this.sort);
    };
    QueryVariable.prototype.sortVariableValues = function (options, sortOrder) {
        if (sortOrder === 0) {
            return options;
        }
        var sortType = Math.ceil(sortOrder / 2);
        var reverseSort = sortOrder % 2 === 0;
        if (sortType === 1) {
            options = _.sortBy(options, 'text');
        }
        else if (sortType === 2) {
            options = _.sortBy(options, function (opt) {
                var matches = opt.text.match(/.*?(\d+).*/);
                if (!matches || matches.length < 2) {
                    return -1;
                }
                else {
                    return parseInt(matches[1], 10);
                }
            });
        }
        else if (sortType === 3) {
            options = _.sortBy(options, function (opt) {
                return _.toLower(opt.text);
            });
        }
        if (reverseSort) {
            options = options.reverse();
        }
        return options;
    };
    QueryVariable.prototype.dependsOn = function (variable) {
        return containsVariable(this.query, this.datasource, this.regex, variable.name);
    };
    return QueryVariable;
}());
export { QueryVariable };
variableTypes['query'] = {
    name: 'Query',
    ctor: QueryVariable,
    description: 'Variable values are fetched from a datasource query',
    supportsMulti: true,
};
//# sourceMappingURL=query_variable.js.map