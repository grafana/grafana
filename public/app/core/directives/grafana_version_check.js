define([
  '../core_module',
],
function (coreModule) {
  'use strict';

  coreModule.directive('grafanaVersionCheck', function($http, contextSrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {
        if (contextSrv.version === 'master') {
          return;
        }

        $http({ method: 'GET', url: 'https://grafanarel.s3.amazonaws.com/latest.json' })
        .then(function(response) {
          if (!response.data || !response.data.version) {
            return;
          }

          if (contextSrv.version !== response.data.version) {
            elem.append('<i class="icon-info-sign"></i> ' +
                        '<a href="http://grafana.org/download" target="_blank"> ' +
            'New version available: ' + response.data.version +
              '</a>');
          }
        });
      }
    };
  });
});
