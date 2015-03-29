/*jshint unused:false */
define(['module'], function (module) {
  'use strict';

  var masterConfig = (module.config && module.config()) || {};

  return {
    load: function (name, require, onLoad, config) {
      var url = require.toUrl(name);
      require(['text!'+name], function (text) {
        masterConfig.registerTemplate && masterConfig.registerTemplate(url, text);
        onLoad(text);
      });
    }
  };

});