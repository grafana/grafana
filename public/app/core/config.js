define([
  'app/core/settings',
],
function (Settings) {
  "use strict";

  var bootData = window.grafanaBootData || { settings: {} };
  var options = bootData.settings;
  options.bootData = bootData;

  return new Settings(options);

});
