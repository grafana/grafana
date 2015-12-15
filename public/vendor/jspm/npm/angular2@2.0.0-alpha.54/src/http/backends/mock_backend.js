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
var core_1 = require('../../../core');
var static_request_1 = require('../static_request');
var enums_1 = require('../enums');
var lang_1 = require('../../facade/lang');
var exceptions_1 = require('../../facade/exceptions');
var Subject_1 = require('rxjs/Subject');
var ReplaySubject_1 = require('rxjs/subject/ReplaySubject');
var take_1 = require('rxjs/operator/take');
var MockConnection = (function() {
  function MockConnection(req) {
    this.response = take_1.take.call(new ReplaySubject_1.ReplaySubject(1), 1);
    this.readyState = enums_1.ReadyState.Open;
    this.request = req;
  }
  MockConnection.prototype.mockRespond = function(res) {
    if (this.readyState === enums_1.ReadyState.Done || this.readyState === enums_1.ReadyState.Cancelled) {
      throw new exceptions_1.BaseException('Connection has already been resolved');
    }
    this.readyState = enums_1.ReadyState.Done;
    this.response.next(res);
    this.response.complete();
  };
  MockConnection.prototype.mockDownload = function(res) {};
  MockConnection.prototype.mockError = function(err) {
    this.readyState = enums_1.ReadyState.Done;
    this.response.error(err);
  };
  return MockConnection;
})();
exports.MockConnection = MockConnection;
var MockBackend = (function() {
  function MockBackend() {
    var _this = this;
    this.connectionsArray = [];
    this.connections = new Subject_1.Subject();
    this.connections.subscribe(function(connection) {
      return _this.connectionsArray.push(connection);
    });
    this.pendingConnections = new Subject_1.Subject();
  }
  MockBackend.prototype.verifyNoPendingRequests = function() {
    var pending = 0;
    this.pendingConnections.subscribe(function(c) {
      return pending++;
    });
    if (pending > 0)
      throw new exceptions_1.BaseException(pending + " pending connections to be resolved");
  };
  MockBackend.prototype.resolveAllConnections = function() {
    this.connections.subscribe(function(c) {
      return c.readyState = 4;
    });
  };
  MockBackend.prototype.createConnection = function(req) {
    if (!lang_1.isPresent(req) || !(req instanceof static_request_1.Request)) {
      throw new exceptions_1.BaseException("createConnection requires an instance of Request, got " + req);
    }
    var connection = new MockConnection(req);
    this.connections.next(connection);
    return connection;
  };
  MockBackend = __decorate([core_1.Injectable(), __metadata('design:paramtypes', [])], MockBackend);
  return MockBackend;
})();
exports.MockBackend = MockBackend;
