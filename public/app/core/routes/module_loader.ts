///<reference path="../../headers/require/require.d.ts" />

export class ModuleLoader {
  lazy: any;

  constructor(moduleName) {

    this.lazy = ["$q", "$route", "$rootScope", function($q, $route, $rootScope) {
      var defered = $q.defer();

      require([moduleName], function () {
        defered.resolve();
      });

      return defered.promise;
    }];

  }
}
