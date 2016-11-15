define([
  'lodash',
],
function (_) {
  "use strict";

  return function Settings (options) {
    /**
     * To add a setting, you MUST define a default. Also,
     * THESE ARE ONLY DEFAULTS.
     * They are overridden by config.js in the root directory
     * @type {Object}
     */
    var defaults = {
      datasources                   : {},
      window_title_prefix           : '大数据监控 - ',
      panels                        : {
        'graph':      { path: 'app/panels/graph',      name: '图表' },
        'table':      { path: 'app/panels/table',      name: '表格' },
        'singlestat': { path: 'app/panels/singlestat', name: '状态图' },
        'text':       { path: 'app/panels/text',       name: '文字' },
        'dashlist':   { path: 'app/panels/dashlist',   name: '图表列' },
      },
      new_panel_title: '新的图表',
      plugins: {},
      default_route: '/dashboard/file/default.json',
      playlist_timespan: "1m",
      unsaved_changes_warning: true,
      search: { max_results: 100 },
      appSubUrl: ""
    };

    var settings = _.extend({}, defaults, options);

    // var parseBasicAuth = function(datasource) {
    //   var passwordEnd = datasource.url.indexOf('@');
    //   if (passwordEnd > 0) {
    //     var userStart = datasource.url.indexOf('//') + 2;
    //     var userAndPassword = datasource.url.substring(userStart, passwordEnd);
    //     var bytes = crypto.charenc.Binary.stringToBytes(userAndPassword);
    //     datasource.basicAuth = crypto.util.bytesToBase64(bytes);
    //
    //     var urlHead = datasource.url.substring(0, userStart);
    //     datasource.url = urlHead + datasource.url.substring(passwordEnd + 1);
    //   }
    //
    //   return datasource;
    // };
    //
    // _.each(settings.datasources, function(datasource, key) {
    //   datasource.name = key;
    //   if (datasource.url) { parseBasicAuth(datasource); }
    //   if (datasource.type === 'influxdb') { parseMultipleHosts(datasource); }
    // });

    return settings;
  };
});
