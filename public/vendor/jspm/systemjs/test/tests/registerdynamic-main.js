System.register(["./registerdynamic-notbundled.js"], function(_export) {
  var dependency;
  return {
    setters: [function(_dependency) {
      dependency = _dependency['default'];
    }],
    execute: function() {
      _export("dependency", dependency);
    }
  }
});
