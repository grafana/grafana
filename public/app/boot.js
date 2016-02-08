(function bootGrafana() {
  'use strict';

  System.import('app/grafana').then(function(grafana) {
    grafana.default.init();
  }).catch(function(err) {
    console.log('Loading app module failed: ', err);
  });

})();
