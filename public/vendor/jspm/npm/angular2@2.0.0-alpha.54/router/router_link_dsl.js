/* */ 
'use strict';
var compiler_1 = require('../compiler');
var core_1 = require('../core');
var router_link_transform_1 = require('../src/router/router_link_transform');
var lang_1 = require('../src/facade/lang');
var router_link_transform_2 = require('../src/router/router_link_transform');
exports.RouterLinkTransform = router_link_transform_2.RouterLinkTransform;
var ROUTER_LINK_DSL_PROVIDER = lang_1.CONST_EXPR(new core_1.Provider(compiler_1.TEMPLATE_TRANSFORMS, {
  useClass: router_link_transform_1.RouterLinkTransform,
  multi: true
}));
