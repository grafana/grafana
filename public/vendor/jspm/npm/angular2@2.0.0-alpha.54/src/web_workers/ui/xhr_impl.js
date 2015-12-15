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
var di_1 = require('../../core/di');
var serializer_1 = require('../shared/serializer');
var messaging_api_1 = require('../shared/messaging_api');
var xhr_1 = require('../../compiler/xhr');
var service_message_broker_1 = require('../shared/service_message_broker');
var bind_1 = require('./bind');
var MessageBasedXHRImpl = (function() {
  function MessageBasedXHRImpl(_brokerFactory, _xhr) {
    this._brokerFactory = _brokerFactory;
    this._xhr = _xhr;
  }
  MessageBasedXHRImpl.prototype.start = function() {
    var broker = this._brokerFactory.createMessageBroker(messaging_api_1.XHR_CHANNEL);
    broker.registerMethod("get", [serializer_1.PRIMITIVE], bind_1.bind(this._xhr.get, this._xhr), serializer_1.PRIMITIVE);
  };
  MessageBasedXHRImpl = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [service_message_broker_1.ServiceMessageBrokerFactory, xhr_1.XHR])], MessageBasedXHRImpl);
  return MessageBasedXHRImpl;
})();
exports.MessageBasedXHRImpl = MessageBasedXHRImpl;
