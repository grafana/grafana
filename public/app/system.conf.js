System.config({
  defaultJSExtenions: true,
  baseURL: 'public',
  paths: {
    'virtual-scroll': 'vendor/npm/virtual-scroll/src/index.js',
    'mousetrap': 'vendor/npm/mousetrap/mousetrap.js',
    'remarkable': 'vendor/npm/remarkable/dist/remarkable.js',
    'tether': 'vendor/npm/tether/dist/js/tether.js',
    'eventemitter3': 'vendor/npm/eventemitter3/index.js',
    'tether-drop': 'vendor/npm/tether-drop/dist/js/drop.js',
    'moment': 'vendor/moment.js',
    "jquery": "vendor/jquery/dist/jquery.js",
    'lodash-src': 'vendor/lodash/dist/lodash.js',
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
    "jquery.flot.selection": "vendor/flot/jquery.flot.selection",
    "jquery.flot.stack": "vendor/flot/jquery.flot.stack",
    "jquery.flot.stackpercent": "vendor/flot/jquery.flot.stackpercent",
    "jquery.flot.time": "vendor/flot/jquery.flot.time",
    "jquery.flot.crosshair": "vendor/flot/jquery.flot.crosshair",
    "jquery.flot.fillbelow": "vendor/flot/jquery.flot.fillbelow",
    "jquery.flot.gauge": "vendor/flot/jquery.flot.gauge",
    "d3": "vendor/d3/d3.js",
    "jquery.flot.dashes": "vendor/flot/jquery.flot.dashes",
    "ace": "vendor/npm/ace-builds/src-noconflict/ace"
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
    text: 'vendor/plugin-text/text.js',
    css: 'app/core/utils/css_loader.js'
  },

  meta: {
    'vendor/npm/virtual-scroll/src/indx.js': {
      format: 'cjs',
      exports: 'VirtualScroll',
    },
    'vendor/angular/angular.js': {
      format: 'global',
      deps: ['jquery'],
      exports: 'angular',
    },
    'vendor/npm/eventemitter3/index.js': {
      format: 'cjs',
      exports: 'EventEmitter'
    },
    'vendor/npm/mousetrap/mousetrap.js': {
      format: 'global',
      exports: 'Mousetrap'
    },
    'vendor/npm/ace-builds/src-noconflict/ace.js': {
      format: 'global',
      exports: 'ace'
    }
  }
});
