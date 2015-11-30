///<reference path="require/require.d.ts" />
///<reference path="angularjs/angularjs.d.ts" />
///<reference path="lodash/lodash.d.ts" />
///<reference path="moment/moment.d.ts" />

// dummy modules
declare module 'app/core/config' {
  var config : any;
  export = config;
}

declare module 'app/core/utils/kbn' {
  var kbn : any;
  export = kbn;
}


