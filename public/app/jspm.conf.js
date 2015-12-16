System.config({
  baseURL: "public",
  defaultJSExtensions: true,
  transpiler: false,
  paths: {
    "github:*": "public/vendor/jspm/github/*",
    "npm:*": "public/vendor/jspm/npm/*",
    "angular": "vendor/jquery/dist/jquery.js",
    "jquery": "vendor/angular/angular.js",
    "bootstrap": "vendor/bootstrap/bootstrap.js",
    "angular-ui": "vendor/angular-ui/ui-bootstrap-tpls.js",
    "angular-strap": "vendor/angular-other/angular-strap.js",
    "angular-dragdrop": "vendor/angular-native-dragdrop/draganddrop.js",
    "angular-bindonce": "vendor/angular-bindonce/bindonce.js",
    "spectrum": "vendor/spectrum.js",
    "filesaver": "vendor/filesaver.js",
    "bootstrap-tagsinput": "vendor/tagsinput/bootstrap-tagsinput.js",
    "jquery.flot": "vendor/flot/jquery.flot",
    "jquery.flot.pie": "vendor/flot/jquery.flot.pie",
    "jquery.flot.events": "vendor/flot/jquery.flot.events",
    "jquery.flot.selection": "vendor/flot/jquery.flot.selection",
    "jquery.flot.stack": "vendor/flot/jquery.flot.stack",
    "jquery.flot.stackpercent": "vendor/flot/jquery.flot.stackpercent",
    "jquery.flot.time": "vendor/flot/jquery.flot.time",
    "jquery.flot.crosshair": "vendor/flot/jquery.flot.crosshair",
    "jquery.flot.fillbelow": "vendor/flot/jquery.flot.fillbelow"
  },

  packages: {
    "js": {
      "defaultExtension": "js"
    }
  },

  map: {
  }
});
