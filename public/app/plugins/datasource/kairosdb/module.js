define([
  'require',
  'exports',
  './datasource',
  './query_ctrl'
],
function (require, exports, datasource_1, query_ctrl_1) {
  'use strict';
  exports.Datasource = datasource_1.KairosDBDatasource;
  exports.QueryCtrl = query_ctrl_1.KairosDBQueryCtrl;
  var KairosDBConfigCtrl = (function () {
    function KairosDBConfigCtrl() {
    }
    KairosDBConfigCtrl.templateUrl = "partials/config.html";
    return KairosDBConfigCtrl;
  })();
  exports.ConfigCtrl = KairosDBConfigCtrl;
  var KairosDBQueryOptionsCtrl = (function () {
    function KairosDBQueryOptionsCtrl() {
    }
    KairosDBQueryOptionsCtrl.templateUrl = "partials/query.options.html";
    return KairosDBQueryOptionsCtrl;
  })();
  exports.QueryOptionsCtrl = KairosDBQueryOptionsCtrl;
});
