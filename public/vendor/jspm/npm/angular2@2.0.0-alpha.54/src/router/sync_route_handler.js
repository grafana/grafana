/* */ 
'use strict';
var async_1 = require('../facade/async');
var lang_1 = require('../facade/lang');
var instruction_1 = require('./instruction');
var SyncRouteHandler = (function() {
  function SyncRouteHandler(componentType, data) {
    this.componentType = componentType;
    this._resolvedComponent = null;
    this._resolvedComponent = async_1.PromiseWrapper.resolve(componentType);
    this.data = lang_1.isPresent(data) ? new instruction_1.RouteData(data) : instruction_1.BLANK_ROUTE_DATA;
  }
  SyncRouteHandler.prototype.resolveComponentType = function() {
    return this._resolvedComponent;
  };
  return SyncRouteHandler;
})();
exports.SyncRouteHandler = SyncRouteHandler;
