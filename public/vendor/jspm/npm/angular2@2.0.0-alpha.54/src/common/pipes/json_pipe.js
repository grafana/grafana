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
var lang_1 = require('../../facade/lang');
var core_1 = require('../../../core');
var JsonPipe = (function() {
  function JsonPipe() {}
  JsonPipe.prototype.transform = function(value, args) {
    if (args === void 0) {
      args = null;
    }
    return lang_1.Json.stringify(value);
  };
  JsonPipe = __decorate([lang_1.CONST(), core_1.Pipe({
    name: 'json',
    pure: false
  }), core_1.Injectable(), __metadata('design:paramtypes', [])], JsonPipe);
  return JsonPipe;
})();
exports.JsonPipe = JsonPipe;
