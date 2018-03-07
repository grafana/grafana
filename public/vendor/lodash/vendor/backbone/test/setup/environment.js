(function(QUnit) {

  var sync = Backbone.sync;
  var ajax = Backbone.ajax;
  var emulateHTTP = Backbone.emulateHTTP;
  var emulateJSON = Backbone.emulateJSON;
  var history = window.history;
  var pushState = history.pushState;
  var replaceState = history.replaceState;

  QUnit.config.noglobals = true;

  QUnit.testStart(function() {
    var env = QUnit.config.current.testEnvironment;

    // We never want to actually call these during tests.
    history.pushState = history.replaceState = function() {};

    // Capture ajax settings for comparison.
    Backbone.ajax = function(settings) {
      env.ajaxSettings = settings;
    };

    // Capture the arguments to Backbone.sync for comparison.
    Backbone.sync = function(method, model, options) {
      env.syncArgs = {
        method: method,
        model: model,
        options: options
      };
      sync.apply(this, arguments);
    };

  });

  QUnit.testDone(function() {
    Backbone.sync = sync;
    Backbone.ajax = ajax;
    Backbone.emulateHTTP = emulateHTTP;
    Backbone.emulateJSON = emulateJSON;
    history.pushState = pushState;
    history.replaceState = replaceState;
  });

})(QUnit);
