///<reference path="require/require.d.ts" />
///<reference path="angularjs/angularjs.d.ts" />
///<reference path="lodash/lodash.d.ts" />
///<reference path="angular2/angular2.d.ts" />
///<reference path="moment/moment.d.ts" />
///<reference path="es6-promise/es6-promise.d.ts" />

// dummy modules
declare module 'app/core/config' {
  var config : any;
  export = config;
}

declare var System: any;

declare module 'app/core/utils/kbn' {
  var kbn : any;
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
