define([
  'app/core/store',
  'angular',
],
function (store, angular) {
  'use strict';

  return {
    get: function() {
      var json = store.get("copiedPanel");
      var panel = null;
      try {
        panel = JSON.parse(json);
      } catch(err) {
        this.clear();
      }
      return panel;
    },
    set: function(panel, namePrefix) {
      var copy = angular.copy(panel);
      copy.title = namePrefix + copy.title;
      delete copy["id"];
      delete copy["span"];
      store.set("copiedPanel", JSON.stringify(copy));
    },
    clear: function() {
      store.delete("copiedPanel");
    }
  };
});
