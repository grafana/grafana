define([
], function()  {
  'use strict';

  function StreamPageCtrl() {}
  StreamPageCtrl.templateUrl = 'partials/stream.html';

  function LogsPageCtrl() {}
  LogsPageCtrl.templateUrl = 'partials/logs.html';

  function NginxConfigCtrl() {}
  NginxConfigCtrl.templateUrl = 'partials/config.html';

  return {
    ConfigCtrl: NginxConfigCtrl,
    StreamPageCtrl: StreamPageCtrl,
    LogsPageCtrl: LogsPageCtrl,
  };

});
