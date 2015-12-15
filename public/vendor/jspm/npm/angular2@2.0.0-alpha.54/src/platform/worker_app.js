/* */ 
'use strict';
var ng_zone_1 = require('../core/zone/ng_zone');
var di_1 = require('../core/di');
var parse5_adapter_1 = require('./server/parse5_adapter');
var post_message_bus_1 = require('../web_workers/shared/post_message_bus');
var worker_app_common_1 = require('./worker_app_common');
var core_1 = require('../../core');
var message_bus_1 = require('../web_workers/shared/message_bus');
var _postMessage = {postMessage: function(message, transferrables) {
    postMessage(message, transferrables);
  }};
exports.WORKER_APP_APPLICATION = [worker_app_common_1.WORKER_APP_APPLICATION_COMMON, new di_1.Provider(message_bus_1.MessageBus, {
  useFactory: createMessageBus,
  deps: [ng_zone_1.NgZone]
}), new di_1.Provider(core_1.APP_INITIALIZER, {
  useValue: setupWebWorker,
  multi: true
})];
function createMessageBus(zone) {
  var sink = new post_message_bus_1.PostMessageBusSink(_postMessage);
  var source = new post_message_bus_1.PostMessageBusSource();
  var bus = new post_message_bus_1.PostMessageBus(sink, source);
  bus.attachToZone(zone);
  return bus;
}
function setupWebWorker() {
  parse5_adapter_1.Parse5DomAdapter.makeCurrent();
}
