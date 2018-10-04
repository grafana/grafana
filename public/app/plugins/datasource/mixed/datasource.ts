import angular from 'angular';
import _ from 'lodash';

class MixedDatasource {
  /** @ngInject */
  constructor(private $q, private datasourceSrv) {}

  query(options) {
    const sets = _.groupBy(options.targets, 'datasource');
    const promises = _.map(sets, targets => {
      const dsName = targets[0].datasource;
      if (dsName === '-- Mixed --') {
        return this.$q([]);
      }

      return this.datasourceSrv.get(dsName).then(ds => {
        const opt = angular.copy(options);
        opt.targets = targets;
        return ds.query(opt);
      });
    });

    return this.$q.all(promises).then(results => {
      return { data: _.flatten(_.map(results, 'data')) };
    });
  }
}

export { MixedDatasource, MixedDatasource as Datasource };
