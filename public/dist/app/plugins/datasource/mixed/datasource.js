import angular from 'angular';
import _ from 'lodash';
var MixedDatasource = /** @class */ (function () {
    /** @ngInject */
    function MixedDatasource($q, datasourceSrv) {
        this.$q = $q;
        this.datasourceSrv = datasourceSrv;
    }
    MixedDatasource.prototype.query = function (options) {
        var _this = this;
        var sets = _.groupBy(options.targets, 'datasource');
        var promises = _.map(sets, function (targets) {
            var dsName = targets[0].datasource;
            if (dsName === '-- Mixed --') {
                return _this.$q([]);
            }
            return _this.datasourceSrv.get(dsName).then(function (ds) {
                var opt = angular.copy(options);
                opt.targets = targets;
                return ds.query(opt);
            });
        });
        return this.$q.all(promises).then(function (results) {
            return { data: _.flatten(_.map(results, 'data')) };
        });
    };
    return MixedDatasource;
}());
export { MixedDatasource, MixedDatasource as Datasource };
//# sourceMappingURL=datasource.js.map