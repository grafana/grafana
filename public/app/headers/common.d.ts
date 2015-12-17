///<reference path="lodash/lodash.d.ts" />
///<reference path="../../vendor/npm/angular2/typings/tsd.d.ts" />
///<reference path="../../vendor/npm/angular2/manual_typings/globals.d.ts" />

// dummy modules
declare module 'app/core/config' {
  var config : any;
  export = config;
}

declare var System: any;

declare module 'moment' {
  var moment : any;
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
  export = kbn;
}

declare module 'app/core/store' {
  var store : any;
  export = store;
}

declare module 'angular-route' {
  var kbn : any;
  export = kbn;
}

declare module 'angular-sanitize' {
  var kbn : any;
  export = kbn;
}

declare module 'bootstrap' {
  var kbn : any;
  export = kbn;
}

declare module 'angular-strap' {
  var kbn : any;
  export = kbn;
}

declare module 'angular-dragdrop' {
  var kbn : any;
  export = kbn;
}
