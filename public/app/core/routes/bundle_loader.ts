///<reference path="../../headers/require/require.d.ts" />

export class BundleLoader {
  lazy: any;
  loadingDefer: any;

  constructor(bundleName) {
    this.lazy = ["$q", "$route", "$rootScope", ($q, $route, $rootScope) => {
      if (this.loadingDefer) {
        return this.loadingDefer.promise;
      }

      this.loadingDefer = $q.defer();

      require([bundleName], () => {
        this.loadingDefer.resolve();
      });

      return this.loadingDefer.promise;
    }];

  }
}
