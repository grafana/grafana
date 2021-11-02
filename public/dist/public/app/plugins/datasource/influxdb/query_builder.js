import { reduce } from 'lodash';
import kbn from 'app/core/utils/kbn';
function renderTagCondition(tag, index) {
    // FIXME: merge this function with influx_query_model/renderTagCondition
    var str = '';
    var operator = tag.operator;
    var value = tag.value;
    if (index > 0) {
        str = (tag.condition || 'AND') + ' ';
    }
    if (!operator) {
        if (/^\/.*\/$/.test(tag.value)) {
            operator = '=~';
        }
        else {
            operator = '=';
        }
    }
    // quote value unless regex or number, or if empty-string
    if (value === '' || (operator !== '=~' && operator !== '!~' && isNaN(+value))) {
        value = "'" + value.replace(/\\/g, '\\\\').replace(/\'/g, "\\'") + "'";
    }
    return str + '"' + tag.key + '" ' + operator + ' ' + value;
}
var InfluxQueryBuilder = /** @class */ (function () {
    function InfluxQueryBuilder(target, database) {
        this.target = target;
        this.database = database;
    }
    InfluxQueryBuilder.prototype.buildExploreQuery = function (type, withKey, withMeasurementFilter) {
        var query = '';
        var measurement;
        var policy;
        if (type === 'TAG_KEYS') {
            query = 'SHOW TAG KEYS';
            measurement = this.target.measurement;
            policy = this.target.policy;
        }
        else if (type === 'TAG_VALUES') {
            query = 'SHOW TAG VALUES';
            measurement = this.target.measurement;
            policy = this.target.policy;
        }
        else if (type === 'MEASUREMENTS') {
            query = 'SHOW MEASUREMENTS';
            if (withMeasurementFilter) {
                // we do a case-insensitive regex-based lookup
                query += ' WITH MEASUREMENT =~ /(?i)' + kbn.regexEscape(withMeasurementFilter) + '/';
            }
        }
        else if (type === 'FIELDS') {
            measurement = this.target.measurement;
            policy = this.target.policy;
            if (!measurement.match('^/.*/')) {
                measurement = '"' + measurement + '"';
                if (policy && policy !== 'default') {
                    policy = '"' + policy + '"';
                    measurement = policy + '.' + measurement;
                }
            }
            return 'SHOW FIELD KEYS FROM ' + measurement;
        }
        else if (type === 'RETENTION POLICIES') {
            query = 'SHOW RETENTION POLICIES on "' + this.database + '"';
            return query;
        }
        if (measurement) {
            if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
                measurement = '"' + measurement + '"';
            }
            if (policy && policy !== 'default') {
                policy = '"' + policy + '"';
                measurement = policy + '.' + measurement;
            }
            query += ' FROM ' + measurement;
        }
        if (withKey) {
            query += ' WITH KEY = "' + withKey + '"';
        }
        if (this.target.tags && this.target.tags.length > 0) {
            var whereConditions = reduce(this.target.tags, function (memo, tag) {
                // do not add a condition for the key we want to explore for
                if (tag.key === withKey) {
                    return memo;
                }
                // value operators not supported in these types of queries
                if (tag.operator === '>' || tag.operator === '<') {
                    return memo;
                }
                memo.push(renderTagCondition(tag, memo.length));
                return memo;
            }, []);
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
    return InfluxQueryBuilder;
}());
export { InfluxQueryBuilder };
//# sourceMappingURL=query_builder.js.map