export class BundleLoader {
  lazy: any;

  constructor(bundleName) {
    var defer = null;

    this.lazy = [
      '$q',
      '$route',
      '$rootScope',
      ($q, $route, $rootScope) => {
        if (defer) {
          return defer.promise;
        }

        defer = $q.defer();

        System.import(bundleName).then(() => {
          defer.resolve();
        });

        return defer.promise;
      },
    ];
  }
}
