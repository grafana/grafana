(function bootGrafana() {
  'use strict';

  var systemLocate = System.locate;
  System.locate = function(load) {
    var System = this;
    return Promise.resolve(systemLocate.call(this, load)).then(function(address) {
      return address + System.cacheBust;
    });
  };
  System.cacheBust = '?bust=' + Date.now();

  System.import('app/app').then(function(app) {
    app.default.init();
  }).catch(function(err) {
    console.log('Loading app module failed: ', err);
  });

})();
