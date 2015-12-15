/* */ 
'use strict';
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
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
var exceptions_1 = require('../../facade/exceptions');
var intl_1 = require('../../facade/intl');
var core_1 = require('../../../core');
var collection_1 = require('../../facade/collection');
var invalid_pipe_argument_exception_1 = require('./invalid_pipe_argument_exception');
var defaultLocale = 'en-US';
var _re = lang_1.RegExpWrapper.create('^(\\d+)?\\.((\\d+)(\\-(\\d+))?)?$');
var NumberPipe = (function() {
  function NumberPipe() {}
  NumberPipe._format = function(value, style, digits, currency, currencyAsSymbol) {
    if (currency === void 0) {
      currency = null;
    }
    if (currencyAsSymbol === void 0) {
      currencyAsSymbol = false;
    }
    if (lang_1.isBlank(value))
      return null;
    if (!lang_1.isNumber(value)) {
      throw new invalid_pipe_argument_exception_1.InvalidPipeArgumentException(NumberPipe, value);
    }
    var minInt = 1,
        minFraction = 0,
        maxFraction = 3;
    if (lang_1.isPresent(digits)) {
      var parts = lang_1.RegExpWrapper.firstMatch(_re, digits);
      if (lang_1.isBlank(parts)) {
        throw new exceptions_1.BaseException(digits + " is not a valid digit info for number pipes");
      }
      if (lang_1.isPresent(parts[1])) {
        minInt = lang_1.NumberWrapper.parseIntAutoRadix(parts[1]);
      }
      if (lang_1.isPresent(parts[3])) {
        minFraction = lang_1.NumberWrapper.parseIntAutoRadix(parts[3]);
      }
      if (lang_1.isPresent(parts[5])) {
        maxFraction = lang_1.NumberWrapper.parseIntAutoRadix(parts[5]);
      }
    }
    return intl_1.NumberFormatter.format(value, defaultLocale, style, {
      minimumIntegerDigits: minInt,
      minimumFractionDigits: minFraction,
      maximumFractionDigits: maxFraction,
      currency: currency,
      currencyAsSymbol: currencyAsSymbol
    });
  };
  NumberPipe = __decorate([lang_1.CONST(), core_1.Injectable(), __metadata('design:paramtypes', [])], NumberPipe);
  return NumberPipe;
})();
exports.NumberPipe = NumberPipe;
var DecimalPipe = (function(_super) {
  __extends(DecimalPipe, _super);
  function DecimalPipe() {
    _super.apply(this, arguments);
  }
  DecimalPipe.prototype.transform = function(value, args) {
    var digits = collection_1.ListWrapper.first(args);
    return NumberPipe._format(value, intl_1.NumberFormatStyle.Decimal, digits);
  };
  DecimalPipe = __decorate([lang_1.CONST(), core_1.Pipe({name: 'number'}), core_1.Injectable(), __metadata('design:paramtypes', [])], DecimalPipe);
  return DecimalPipe;
})(NumberPipe);
exports.DecimalPipe = DecimalPipe;
var PercentPipe = (function(_super) {
  __extends(PercentPipe, _super);
  function PercentPipe() {
    _super.apply(this, arguments);
  }
  PercentPipe.prototype.transform = function(value, args) {
    var digits = collection_1.ListWrapper.first(args);
    return NumberPipe._format(value, intl_1.NumberFormatStyle.Percent, digits);
  };
  PercentPipe = __decorate([lang_1.CONST(), core_1.Pipe({name: 'percent'}), core_1.Injectable(), __metadata('design:paramtypes', [])], PercentPipe);
  return PercentPipe;
})(NumberPipe);
exports.PercentPipe = PercentPipe;
var CurrencyPipe = (function(_super) {
  __extends(CurrencyPipe, _super);
  function CurrencyPipe() {
    _super.apply(this, arguments);
  }
  CurrencyPipe.prototype.transform = function(value, args) {
    var currencyCode = lang_1.isPresent(args) && args.length > 0 ? args[0] : 'USD';
    var symbolDisplay = lang_1.isPresent(args) && args.length > 1 ? args[1] : false;
    var digits = lang_1.isPresent(args) && args.length > 2 ? args[2] : null;
    return NumberPipe._format(value, intl_1.NumberFormatStyle.Currency, digits, currencyCode, symbolDisplay);
  };
  CurrencyPipe = __decorate([lang_1.CONST(), core_1.Pipe({name: 'currency'}), core_1.Injectable(), __metadata('design:paramtypes', [])], CurrencyPipe);
  return CurrencyPipe;
})(NumberPipe);
exports.CurrencyPipe = CurrencyPipe;
