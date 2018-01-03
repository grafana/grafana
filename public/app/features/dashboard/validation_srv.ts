import coreModule from 'app/core/core_module';

export class ValidationSrv {
  rootName = 'root';

  /** @ngInject */
  constructor(private $q, private backendSrv) {}

  validateNewDashboardOrFolderName(name) {
    name = (name || '').trim();

    if (name.length === 0) {
      return this.$q.reject({
        type: 'REQUIRED',
        message: 'Name is required',
      });
    }

    if (name.toLowerCase() === this.rootName) {
      return this.$q.reject({
        type: 'EXISTING',
        message: 'A folder or dashboard with the same name already exists',
      });
    }

    let deferred = this.$q.defer();

    this.backendSrv.search({ query: name }).then(res => {
      for (let hit of res) {
        if (name.toLowerCase() === hit.title.toLowerCase()) {
          deferred.reject({
            type: 'EXISTING',
            message: 'A folder or dashboard with the same name already exists',
          });
          break;
        }
      }

      deferred.resolve();
    });

    return deferred.promise;
  }
}

coreModule.service('validationSrv', ValidationSrv);
