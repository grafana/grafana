(function bootGrafana() {
  'use strict';

  System.import('app/app').then(function(app) {
    app.init();
  }).catch(function(err) {
    console.log('Loading app module failed: ', err);
  });

})();
