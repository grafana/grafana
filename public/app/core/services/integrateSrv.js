define([
    'angular',
    '../core_module',
],
function (angular,coreModule) {
  'use strict';
  coreModule.default.service('integrateSrv',function () {
    return {
        options : {}
    }
  });
});