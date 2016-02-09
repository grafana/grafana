define([
], function()  {
  'use strict';

  function StreamPageCtrl() {}
  StreamPageCtrl.templateUrl = 'public/plugins/nginx-app/partials/stream.html';

  function LogsPageCtrl() {}
  LogsPageCtrl.templateUrl = 'public/plugins/nginx-app/partials/logs.html';

  function NginxConfigCtrl() {}
  NginxConfigCtrl.templateUrl = 'public/plugins/nginx-app/partials/config.html';

  return {
    ConfigCtrl: NginxConfigCtrl,
    StreamPageCtrl: StreamPageCtrl,
    LogsPageCtrl: LogsPageCtrl,
  };

});
