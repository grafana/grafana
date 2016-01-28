define([], function() {
  'use strict';

  return {
    get: function(key) {
      return window.localStorage[key];
    },
    set: function(key, value) {
      window.localStorage[key] = value;
    },
    getBool: function(key, def) {
      if (def !== void 0 && !this.exists(key)) {
        return def;
      }
      return window.localStorage[key] === 'true';
    },
    exists: function(key) {
      return window.localStorage[key] !== void 0;
    },
    delete: function(key) {
      window.localStorage.removeItem(key);
    }

  };

});
