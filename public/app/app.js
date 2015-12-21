define([
  './grafana'
], function(app) {
  'use strict';
  // backward compatability hack;
  console.log(app);
  return app.default;
});
