/* */ 
'use strict';
var decorators_1 = require('../core/util/decorators');
var lifecycle_annotations_impl_1 = require('./lifecycle_annotations_impl');
var lifecycle_annotations_impl_2 = require('./lifecycle_annotations_impl');
exports.routerCanReuse = lifecycle_annotations_impl_2.routerCanReuse;
exports.routerCanDeactivate = lifecycle_annotations_impl_2.routerCanDeactivate;
exports.routerOnActivate = lifecycle_annotations_impl_2.routerOnActivate;
exports.routerOnReuse = lifecycle_annotations_impl_2.routerOnReuse;
exports.routerOnDeactivate = lifecycle_annotations_impl_2.routerOnDeactivate;
exports.CanActivate = decorators_1.makeDecorator(lifecycle_annotations_impl_1.CanActivate);
