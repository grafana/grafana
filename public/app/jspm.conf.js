System.config({
  defaultJSExtenions: true,
  paths: {
    moment:   'public/vendor/moment.js',
    "jquery": "public/vendor/jquery/dist/jquery.js",
    'lodash-src': 'public/vendor/lodash.js',
    "lodash": 'public/app/core/lodash_extended.js',
    "angular": "public/vendor/angular/angular.js",
    "bootstrap": "public/vendor/bootstrap/bootstrap.js",
    'angular-route':          'public/vendor/angular-route/angular-route.js',
    'angular-sanitize':       'public/vendor/angular-sanitize/angular-sanitize.js',
    "angular-ui":             "public/vendor/angular-ui/ui-bootstrap-tpls.js",
    "angular-strap":          "public/vendor/angular-other/angular-strap.js",
    "angular-dragdrop":       "public/vendor/angular-native-dragdrop/draganddrop.js",
    "angular-bindonce":       "public/vendor/angular-bindonce/bindonce.js",
    "spectrum": "public/vendor/spectrum.js",
    "filesaver": "public/vendor/filesaver.js",
    "bootstrap-tagsinput": "public/vendor/tagsinput/bootstrap-tagsinput.js",
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
    app: {
      defaultExtension: 'js',
    },
  },

  map: {
    'vendor/jspm/angular2': 'angular2',
    app: 'public/app',
    vendor: 'public/vendor',
  },

  meta: {
    'vendor/angular/angular.js': {
      format: 'amd',
      deps: ['jquery'],
      exports: 'angular',
    }

  }

});
