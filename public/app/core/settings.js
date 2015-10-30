define([
  'lodash',
],
function (_) {
  "use strict";

  return function Settings (options) {
    var defaults = {
      datasources                   : {},
      window_title_prefix           : 'Grafana - ',
      panels                        : {
        'graph':      { path: 'app/panels/graph',      name: 'Graph' },
        'singlestat': { path: 'app/panels/singlestat', name: 'Single stat' },
        'text':       { path: 'app/panels/text',       name: 'Text' },
        'dashlist':   { path: 'app/panels/dashlist',   name: 'Dashboard list' },
      },
      new_panel_title: 'no title (click here)',
      plugins: {},
      playlist_timespan: "1m",
      unsaved_changes_warning: true,
      appSubUrl: ""
    };

    var settings = _.extend({}, defaults, options);
    return settings;
  };
});
