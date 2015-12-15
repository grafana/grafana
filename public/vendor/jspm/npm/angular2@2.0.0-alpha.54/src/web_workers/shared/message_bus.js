/* */ 
'use strict';
var async_1 = require('../../facade/async');
exports.EventEmitter = async_1.EventEmitter;
exports.Observable = async_1.Observable;
var MessageBus = (function() {
  function MessageBus() {}
  return MessageBus;
})();
exports.MessageBus = MessageBus;
