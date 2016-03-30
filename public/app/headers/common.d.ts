///<reference path="../../vendor/npm/angular2/typings/es6-promise/es6-promise.d.ts" />
///<reference path="../../vendor/npm/angular2/typings/es6-collections/es6-collections.d.ts" />

declare var System: any;

// dummy modules
declare module 'app/core/config' {
  var config: any;
  export default config;
}

declare module 'lodash' {
  var lodash: any;
  export default lodash;
}

declare module 'moment' {
  var moment: any;
  export default moment;
}

declare module 'angular' {
  var angular: any;
  export default angular;
}

declare module 'jquery' {
  var jquery: any;
  export default jquery;
}

declare module 'app/core/utils/kbn' {
  var kbn: any;
  export default kbn;
}

declare module 'app/core/store' {
  var store: any;
  export default store;
}

declare module 'tether' {
  var config: any;
  export default config;
}

declare module 'tether-drop' {
  var config: any;
  export default config;
}
