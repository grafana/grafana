define([
  'app/core/settings',
],
function (Settings) {
  "use strict";

  var bootData = window.grafanaBootData || { settings: {} };
  var options = bootData.settings;

  return new Settings(options);

});
