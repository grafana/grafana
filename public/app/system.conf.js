System.config({
  defaultJSExtenions: true,
  baseURL: 'public',
  paths: {
    'remarkable': 'vendor/npm/remarkable/dist/remarkable.js',
    'tether': 'vendor/npm/tether/dist/js/tether.js',
    'eventemitter3': 'vendor/npm/eventemitter3/index.js',
    'tether-drop': 'vendor/npm/tether-drop/dist/js/drop.js',
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
    "jquery.flot.selection": "vendor/flot/jquery.flot.selection",
    "jquery.flot.stack": "vendor/flot/jquery.flot.stack",
    "jquery.flot.stackpercent": "vendor/flot/jquery.flot.stackpercent",
    "jquery.flot.time":         "vendor/flot/jquery.flot.time",
    "jquery.flot.crosshair":    "vendor/flot/jquery.flot.crosshair",
    "jquery.flot.fillbelow":    "vendor/flot/jquery.flot.fillbelow",
    'jquery.flot.fillbetween':  'vendor/flot/jquery.flot.fillbetween',

    "highlight":                'vendor/angular-other/highlight',
    "slider":                   'vendor/angular-other/nouislider.min',
    'fullcalendar':             'vendor/fullcalendar/dist/fullcalendar.min',
    'ui.calendar':              'vendor/angular-ui-calendar/src/calendar',
    'zh-cn':                    'vendor/fullcalendar/dist/zh-cn',
    'bootstrap-table':          'vendor/angular-other/bootstrap-table',
    'jsPlumbToolkit':           'vendor/jsPlumb/jsPlumbToolkit',
    'jsPlumbToolkit-angular':   'vendor/jsPlumb/jsPlumbToolkit-angular',

    "angular-strap.tpl":        "vendor/angular-other/angular-strap.tpl",
    "angular-strap-old":        "vendor/angular-other/angular-strap-old",

    "jquery.flot.gauge": "vendor/flot/jquery.flot.gauge",
    'quill':                    'vendor/quill/quill.min',
    'ng-quill':                 'vendor/quill/ng-quill',
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
    'vendor/angular/angular.js': {
      format: 'global',
      deps: ['jquery'],
      exports: 'angular',
    },
<<<<<<< HEAD
    'vendor/npm/eventemitter3/index.js': {
      format: 'cjs',
      exports: 'EventEmitter'
    },
=======
    'vendor/jsPlumb/jsPlumbToolkit.js': {
      build: false
    },
    'vendor/jsPlumb/jsPlumbToolkit-angular.js': {
      build: false
    },
    'vendor/quill/quill.min.js': {
      build: false
    },
    'vendor/quill/ng-quill.js': {
      build: false
    }
>>>>>>> 90e9b33810b108e3df63c95174165f734e574261
  }
});
