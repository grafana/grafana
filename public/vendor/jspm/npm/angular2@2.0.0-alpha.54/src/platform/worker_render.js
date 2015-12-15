/* */ 
'use strict';
var __decorate = (this && this.__decorate) || function(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
};
var post_message_bus_1 = require('../web_workers/shared/post_message_bus');
var message_bus_1 = require('../web_workers/shared/message_bus');
var core_1 = require('../../core');
var di_1 = require('../core/di');
var worker_render_common_1 = require('./worker_render_common');
var exceptions_1 = require('../facade/exceptions');
var lang_1 = require('../facade/lang');
var WebWorkerInstance = (function() {
  function WebWorkerInstance() {}
  WebWorkerInstance.prototype.init = function(worker, bus) {
    this.worker = worker;
    this.bus = bus;
  };
  WebWorkerInstance = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], WebWorkerInstance);
  return WebWorkerInstance;
})();
exports.WebWorkerInstance = WebWorkerInstance;
exports.WORKER_RENDER_APP = lang_1.CONST_EXPR([worker_render_common_1.WORKER_RENDER_APP_COMMON, WebWorkerInstance, new di_1.Provider(core_1.APP_INITIALIZER, {
  useFactory: function(injector) {
    return function() {
      return initWebWorkerApplication(injector);
    };
  },
  multi: true,
  deps: [di_1.Injector]
}), new di_1.Provider(message_bus_1.MessageBus, {
  useFactory: function(instance) {
    return instance.bus;
  },
  deps: [WebWorkerInstance]
})]);
function initWebWorkerApplication(injector) {
  var scriptUri;
  try {
    scriptUri = injector.get(worker_render_common_1.WORKER_SCRIPT);
  } catch (e) {
    throw new exceptions_1.BaseException("You must provide your WebWorker's initialization script with the WORKER_SCRIPT token");
  }
  var instance = injector.get(WebWorkerInstance);
  spawnWebWorker(scriptUri, instance);
  worker_render_common_1.initializeGenericWorkerRenderer(injector);
}
function spawnWebWorker(uri, instance) {
  var webWorker = new Worker(uri);
  var sink = new post_message_bus_1.PostMessageBusSink(webWorker);
  var source = new post_message_bus_1.PostMessageBusSource(webWorker);
  var bus = new post_message_bus_1.PostMessageBus(sink, source);
  instance.init(webWorker, bus);
}
