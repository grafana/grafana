System.config({
  defaultJSExtenions: true,
  baseURL: 'public',
  paths: {
    'moment': 'vendor/moment.js',
    "jquery": "vendor/jquery/dist/jquery.js",
    'lodash-src': 'vendor/lodash.js',
    "lodash": 'app/core/lodash_extended.js',
    "angular": "vendor/angular/angular.js",
    "bootstrap": "vendor/bootstrap/bootstrap.js",
    'angular-route':          'vendor/angular-route/angular-route.js',
    'angular-sanitize':       'vendor/angular-sanitize/angular-sanitize.js',
    "angular-ui":             "vendor/angular-ui/ui-bootstrap-tpls.js",
    "angular-strap":          "vendor/angular-other/angular-strap.js",
    "angular-dragdrop":       "vendor/angular-native-dragdrop/draganddrop.js",
    "angular-bindonce":       "vendor/angular-bindonce/bindonce.js",
    "spectrum": "vendor/spectrum.js",
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
    app: {
      defaultExtension: 'js',
    },
    vendor: {
      defaultExtension: 'js',
    },
    plugins: {
      defaultExtension: 'js',
    },
    test: {
      defaultExtension: 'js',
    },
  },

  map: {
  },

  meta: {
    'vendor/angular/angular.js': {
      format: 'global',
      deps: ['jquery'],
      exports: 'angular',
    },
  }
});
