/* */ 
'use strict';
function __export(m) {
  for (var p in m)
    if (!exports.hasOwnProperty(p))
      exports[p] = m[p];
}
var router_1 = require('./src/router/router');
exports.Router = router_1.Router;
var router_outlet_1 = require('./src/router/router_outlet');
exports.RouterOutlet = router_outlet_1.RouterOutlet;
var router_link_1 = require('./src/router/router_link');
exports.RouterLink = router_link_1.RouterLink;
var instruction_1 = require('./src/router/instruction');
exports.RouteParams = instruction_1.RouteParams;
exports.RouteData = instruction_1.RouteData;
var platform_location_1 = require('./src/router/platform_location');
exports.PlatformLocation = platform_location_1.PlatformLocation;
var route_registry_1 = require('./src/router/route_registry');
exports.RouteRegistry = route_registry_1.RouteRegistry;
exports.ROUTER_PRIMARY_COMPONENT = route_registry_1.ROUTER_PRIMARY_COMPONENT;
var location_strategy_1 = require('./src/router/location_strategy');
exports.LocationStrategy = location_strategy_1.LocationStrategy;
exports.APP_BASE_HREF = location_strategy_1.APP_BASE_HREF;
var hash_location_strategy_1 = require('./src/router/hash_location_strategy');
exports.HashLocationStrategy = hash_location_strategy_1.HashLocationStrategy;
var path_location_strategy_1 = require('./src/router/path_location_strategy');
exports.PathLocationStrategy = path_location_strategy_1.PathLocationStrategy;
var location_1 = require('./src/router/location');
exports.Location = location_1.Location;
__export(require('./src/router/route_config_decorator'));
__export(require('./src/router/route_definition'));
var lifecycle_annotations_1 = require('./src/router/lifecycle_annotations');
exports.CanActivate = lifecycle_annotations_1.CanActivate;
var instruction_2 = require('./src/router/instruction');
exports.Instruction = instruction_2.Instruction;
exports.ComponentInstruction = instruction_2.ComponentInstruction;
var core_1 = require('./core');
exports.OpaqueToken = core_1.OpaqueToken;
var platform_location_2 = require('./src/router/platform_location');
var location_strategy_2 = require('./src/router/location_strategy');
var path_location_strategy_2 = require('./src/router/path_location_strategy');
var router_2 = require('./src/router/router');
var router_outlet_2 = require('./src/router/router_outlet');
var router_link_2 = require('./src/router/router_link');
var route_registry_2 = require('./src/router/route_registry');
var location_2 = require('./src/router/location');
var core_2 = require('./core');
var lang_1 = require('./src/facade/lang');
var exceptions_1 = require('./src/facade/exceptions');
exports.ROUTER_DIRECTIVES = lang_1.CONST_EXPR([router_outlet_2.RouterOutlet, router_link_2.RouterLink]);
exports.ROUTER_PROVIDERS = lang_1.CONST_EXPR([route_registry_2.RouteRegistry, lang_1.CONST_EXPR(new core_2.Provider(location_strategy_2.LocationStrategy, {useClass: path_location_strategy_2.PathLocationStrategy})), platform_location_2.PlatformLocation, location_2.Location, lang_1.CONST_EXPR(new core_2.Provider(router_2.Router, {
  useFactory: routerFactory,
  deps: lang_1.CONST_EXPR([route_registry_2.RouteRegistry, location_2.Location, route_registry_2.ROUTER_PRIMARY_COMPONENT, core_2.ApplicationRef])
})), lang_1.CONST_EXPR(new core_2.Provider(route_registry_2.ROUTER_PRIMARY_COMPONENT, {
  useFactory: routerPrimaryComponentFactory,
  deps: lang_1.CONST_EXPR([core_2.ApplicationRef])
}))]);
exports.ROUTER_BINDINGS = exports.ROUTER_PROVIDERS;
function routerFactory(registry, location, primaryComponent, appRef) {
  var rootRouter = new router_2.RootRouter(registry, location, primaryComponent);
  appRef.registerDisposeListener(function() {
    return rootRouter.dispose();
  });
  return rootRouter;
}
function routerPrimaryComponentFactory(app) {
  if (app.componentTypes.length == 0) {
    throw new exceptions_1.BaseException("Bootstrap at least one component before injecting Router.");
  }
  return app.componentTypes[0];
}
