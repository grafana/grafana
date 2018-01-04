import angular from 'angular';
import _ from 'lodash';

class MixedDatasource {
  /** @ngInject */
  constructor(private $q, private datasourceSrv) {}

  query(options) {
    var sets = _.groupBy(options.targets, 'datasource');
    var promises = _.map(sets, targets => {
      var dsName = targets[0].datasource;
      if (dsName === '-- Mixed --') {
        return this.$q([]);
      }

      return this.datasourceSrv.get(dsName).then(function(ds) {
        var opt = angular.copy(options);
        opt.targets = targets;
        return ds.query(opt);
      });
    });

    return this.$q.all(promises).then(function(results) {
      return { data: _.flatten(_.map(results, 'data')) };
    });
  }
}

export { MixedDatasource, MixedDatasource as Datasource };
