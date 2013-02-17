// -----
// The `timezoneJS.Date` object gives you full-blown timezone support, independent from the timezone set on the end-user's machine running the browser. It uses the Olson zoneinfo files for its timezone data.
//
// The constructor function and setter methods use proxy JavaScript Date objects behind the scenes, so you can use strings like '10/22/2006' with the constructor. You also get the same sensible wraparound behavior with numeric parameters (like setting a value of 14 for the month wraps around to the next March).
//
// The other significant difference from the built-in JavaScript Date is that `timezoneJS.Date` also has named properties that store the values of year, month, date, etc., so it can be directly serialized to JSON and used for data transfer.

/*
 * Copyright 2010 Matthew Eernisse (mde@fleegix.org)
 * and Open Source Applications Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Credits: Ideas included from incomplete JS implementation of Olson
 * parser, "XMLDAte" by Philippe Goetz (philippe.goetz@wanadoo.fr)
 *
 * Contributions:
 * Jan Niehusmann
 * Ricky Romero
 * Preston Hunt (prestonhunt@gmail.com)
 * Dov. B Katz (dov.katz@morganstanley.com)
 * Peter Bergström (pbergstr@mac.com)
 * Long Ho
 */
(function () {
  // Standard initialization stuff to make sure the library is
  // usable on both client and server (node) side.
  "use strict";
  var root = this;

  var timezoneJS;
  if (typeof exports !== 'undefined') {
    timezoneJS = exports;
  } else {
    timezoneJS = root.timezoneJS = {};
  }

  timezoneJS.VERSION = '0.4.4';

  // Grab the ajax library from global context.
  // This can be jQuery, Zepto or fleegix.
  // You can also specify your own transport mechanism by declaring
  // `timezoneJS.timezone.transport` to a `function`. More details will follow
  var $ = root.$ || root.jQuery || root.Zepto
    , fleegix = root.fleegix
    , _arrIndexOf
  // Declare constant list of days and months. Unfortunately this doesn't leave room for i18n due to the Olson data being in English itself
    , DAYS = timezoneJS.Days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    , MONTHS = timezoneJS.Months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    , SHORT_MONTHS = {}
    , SHORT_DAYS = {}
    , EXACT_DATE_TIME = {}
    , TZ_REGEXP = new RegExp('^[a-zA-Z]+/');

  //`{ "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5, "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11 }`
  for (var i = 0; i < MONTHS.length; i++) {
    SHORT_MONTHS[MONTHS[i].substr(0, 3)] = i;
  }

  //`{ "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 }`
  for (i = 0; i < DAYS.length; i++) {
    SHORT_DAYS[DAYS[i].substr(0, 3)] = i;
  }


  //Handle array indexOf in IE
  //From https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/indexOf
  //Extending Array prototype causes IE to iterate thru extra element
  _arrIndexOf = Array.prototype.indexOf || function (el) {
    if (this === null) {
      throw new TypeError();
    }
    var t = Object(this);
    var len = t.length >>> 0;
    if (len === 0) {
      return -1;
    }
    var n = 0;
    if (arguments.length > 1) {
      n = Number(arguments[1]);
      if (n != n) { // shortcut for verifying if it's NaN
        n = 0;
      } else if (n !== 0 && n !== Infinity && n !== -Infinity) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
    }
    if (n >= len) {
      return -1;
    }
    var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
    for (; k < len; k++) {
      if (k in t && t[k] === el) {
        return k;
      }
    }
    return -1;
  };
  

  // Format a number to the length = digits. For ex:
  //
  // `_fixWidth(2, 2) = '02'`
  //
  // `_fixWidth(1998, 2) = '98'`
  //
  // This is used to pad numbers in converting date to string in ISO standard.
  var _fixWidth = function (number, digits) {
    if (typeof number !== "number") { throw "not a number: " + number; }
    var s = number.toString();
    if (number.length > digits) {
      return number.substr(number.length - digits, number.length);
    }
    while (s.length < digits) {
      s = '0' + s;
    }
    return s;
  };

  // Abstraction layer for different transport layers, including fleegix/jQuery/Zepto
  //
  // Object `opts` include
  //
  // - `url`: url to ajax query
  //
  // - `async`: true for asynchronous, false otherwise. If false, return value will be response from URL. This is true by default
  //
  // - `success`: success callback function
  //
  // - `error`: error callback function
  // Returns response from URL if async is false, otherwise the AJAX request object itself
  var _transport = function (opts) {
    if ((!fleegix || typeof fleegix.xhr === 'undefined') && (!$ || typeof $.ajax === 'undefined')) {
      throw new Error('Please use the Fleegix.js XHR module, jQuery ajax, Zepto ajax, or define your own transport mechanism for downloading zone files.');
    }
    if (!opts) return;
    if (!opts.url) throw new Error ('URL must be specified');
    if (!('async' in opts)) opts.async = true;
    if (!opts.async) {
      return fleegix && fleegix.xhr
      ? fleegix.xhr.doReq({ url: opts.url, async: false })
      : $.ajax({ url : opts.url, async : false }).responseText;
    }
    return fleegix && fleegix.xhr
    ? fleegix.xhr.send({
      url : opts.url,
      method : 'get',
      handleSuccess : opts.success,
      handleErr : opts.error
    })
    : $.ajax({
      url : opts.url,
      dataType: 'text',
      method : 'GET',
      error : opts.error,
      success : opts.success
    });
  };

  // Constructor, which is similar to that of the native Date object itself
  timezoneJS.Date = function () {
    var args = Array.prototype.slice.apply(arguments)
    , dt = null
    , tz = null
    , arr = [];


    //We support several different constructors, including all the ones from `Date` object
    // with a timezone string at the end.
    //
    //- `[tz]`: Returns object with time in `tz` specified.
    //
    // - `utcMillis`, `[tz]`: Return object with UTC time = `utcMillis`, in `tz`.
    //
    // - `Date`, `[tz]`: Returns object with UTC time = `Date.getTime()`, in `tz`.
    //
    // - `year, month, [date,] [hours,] [minutes,] [seconds,] [millis,] [tz]: Same as `Date` object
    // with tz.
    //
    // - `Array`: Can be any combo of the above.
    //
    //If 1st argument is an array, we can use it as a list of arguments itself
    if (Object.prototype.toString.call(args[0]) === '[object Array]') {
      args = args[0];
    }
    if (typeof args[args.length - 1] === 'string' && TZ_REGEXP.test(args[args.length - 1])) {
      tz = args.pop();
    }
    switch (args.length) {
      case 0:
        dt = new Date();
        break;
      case 1:
        dt = new Date(args[0]);
        break;
      default:
        for (var i = 0; i < 7; i++) {
          arr[i] = args[i] || 0;
        }
        dt = new Date(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6]);
        break;
    }

    this._useCache = false;
    this._tzInfo = {};
    this._day = 0;
    this.year = 0;
    this.month = 0;
    this.date = 0;
    this.hours = 0;
    this.minutes = 0;
    this.seconds = 0;
    this.milliseconds = 0;
    this.timezone = tz || null;
    //Tricky part:
    // For the cases where there are 1/2 arguments: `timezoneJS.Date(millis, [tz])` and `timezoneJS.Date(Date, [tz])`. The
    // Date `dt` created should be in UTC. Thus the way I detect such cases is to determine if `arr` is not populated & `tz`
    // is specified. Because if `tz` is not specified, `dt` can be in local time.
    if (arr.length) {
       this.setFromDateObjProxy(dt);
    } else {
       this.setFromTimeProxy(dt.getTime(), tz);
    }
  };

  // Implements most of the native Date object
  timezoneJS.Date.prototype = {
    getDate: function () { return this.date; },
    getDay: function () { return this._day; },
    getFullYear: function () { return this.year; },
    getMonth: function () { return this.month; },
    getYear: function () { return this.year - 1900; },
    getHours: function () { return this.hours; },
    getMilliseconds: function () { return this.milliseconds; },
    getMinutes: function () { return this.minutes; },
    getSeconds: function () { return this.seconds; },
    getUTCDate: function () { return this.getUTCDateProxy().getUTCDate(); },
    getUTCDay: function () { return this.getUTCDateProxy().getUTCDay(); },
    getUTCFullYear: function () { return this.getUTCDateProxy().getUTCFullYear(); },
    getUTCHours: function () { return this.getUTCDateProxy().getUTCHours(); },
    getUTCMilliseconds: function () { return this.getUTCDateProxy().getUTCMilliseconds(); },
    getUTCMinutes: function () { return this.getUTCDateProxy().getUTCMinutes(); },
    getUTCMonth: function () { return this.getUTCDateProxy().getUTCMonth(); },
    getUTCSeconds: function () { return this.getUTCDateProxy().getUTCSeconds(); },
    // Time adjusted to user-specified timezone
    getTime: function () {
      return this._timeProxy + (this.getTimezoneOffset() * 60 * 1000);
    },
    getTimezone: function () { return this.timezone; },
    getTimezoneOffset: function () { return this.getTimezoneInfo().tzOffset; },
    getTimezoneAbbreviation: function () { return this.getTimezoneInfo().tzAbbr; },
    getTimezoneInfo: function () {
      if (this._useCache) return this._tzInfo;
      var res;
      // If timezone is specified, get the correct timezone info based on the Date given
      if (this.timezone) {
        res = this.timezone === 'Etc/UTC' || this.timezone === 'Etc/GMT'
          ? { tzOffset: 0, tzAbbr: 'UTC' }
          : timezoneJS.timezone.getTzInfo(this._timeProxy, this.timezone);
      }
      // If no timezone was specified, use the local browser offset
      else {
        res = { tzOffset: this.getLocalOffset(), tzAbbr: null };
      }
      this._tzInfo = res;
      this._useCache = true;
      return res;
    },
    getUTCDateProxy: function () {
      var dt = new Date(this._timeProxy);
      dt.setUTCMinutes(dt.getUTCMinutes() + this.getTimezoneOffset());
      return dt;
    },
    setDate: function (date) {
      this.setAttribute('date', date);
      return this.getTime();
    },
    setFullYear: function (year, month, date) {
      if (date !== undefined) { this.setAttribute('date', 1); }
      this.setAttribute('year', year);
      if (month !== undefined) { this.setAttribute('month', month); }
      if (date !== undefined) { this.setAttribute('date', date); }
      return this.getTime();
    },
    setMonth: function (month, date) {
      this.setAttribute('month', month);
      if (date !== undefined) { this.setAttribute('date', date); }
      return this.getTime();
    },
    setYear: function (year) {
      year = Number(year);
      if (0 <= year && year <= 99) { year += 1900; }
      this.setUTCAttribute('year', year);
      return this.getTime();
    },
    setHours: function (hours, minutes, seconds, milliseconds) {
      this.setAttribute('hours', hours);
      if (minutes !== undefined) { this.setAttribute('minutes', minutes); }
      if (seconds !== undefined) { this.setAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setMinutes: function (minutes, seconds, milliseconds) {
      this.setAttribute('minutes', minutes);
      if (seconds !== undefined) { this.setAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setSeconds: function (seconds, milliseconds) {
      this.setAttribute('seconds', seconds);
      if (milliseconds !== undefined) { this.setAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setMilliseconds: function (milliseconds) {
      this.setAttribute('milliseconds', milliseconds);
      return this.getTime();
    },
    setTime: function (n) {
      if (isNaN(n)) { throw new Error('Units must be a number.'); }
      this.setFromTimeProxy(n, this.timezone);
      return this.getTime();
    },
    setUTCFullYear: function (year, month, date) {
      if (date !== undefined) { this.setUTCAttribute('date', 1); }
      this.setUTCAttribute('year', year);
      if (month !== undefined) { this.setUTCAttribute('month', month); }
      if (date !== undefined) { this.setUTCAttribute('date', date); }
      return this.getTime();
    },
    setUTCMonth: function (month, date) {
      this.setUTCAttribute('month', month);
      if (date !== undefined) { this.setUTCAttribute('date', date); }
      return this.getTime();
    },
    setUTCDate: function (date) {
      this.setUTCAttribute('date', date);
      return this.getTime();
    },
    setUTCHours: function (hours, minutes, seconds, milliseconds) {
      this.setUTCAttribute('hours', hours);
      if (minutes !== undefined) { this.setUTCAttribute('minutes', minutes); }
      if (seconds !== undefined) { this.setUTCAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setUTCAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setUTCMinutes: function (minutes, seconds, milliseconds) {
      this.setUTCAttribute('minutes', minutes);
      if (seconds !== undefined) { this.setUTCAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setUTCAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setUTCSeconds: function (seconds, milliseconds) {
      this.setUTCAttribute('seconds', seconds);
      if (milliseconds !== undefined) { this.setUTCAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setUTCMilliseconds: function (milliseconds) {
      this.setUTCAttribute('milliseconds', milliseconds);
      return this.getTime();
    },
    setFromDateObjProxy: function (dt) {
      this.year = dt.getFullYear();
      this.month = dt.getMonth();
      this.date = dt.getDate();
      this.hours = dt.getHours();
      this.minutes = dt.getMinutes();
      this.seconds = dt.getSeconds();
      this.milliseconds = dt.getMilliseconds();
      this._day = dt.getDay();
      this._dateProxy = dt;
      this._timeProxy = Date.UTC(this.year, this.month, this.date, this.hours, this.minutes, this.seconds, this.milliseconds);
      this._useCache = false;
    },
    setFromTimeProxy: function (utcMillis, tz) {
      var dt = new Date(utcMillis);
      var tzOffset;
      tzOffset = tz ? timezoneJS.timezone.getTzInfo(dt, tz).tzOffset : dt.getTimezoneOffset();
      dt.setTime(utcMillis + (dt.getTimezoneOffset() - tzOffset) * 60000);
      this.setFromDateObjProxy(dt);
    },
    setAttribute: function (unit, n) {
      if (isNaN(n)) { throw new Error('Units must be a number.'); }
      var dt = this._dateProxy;
      var meth = unit === 'year' ? 'FullYear' : unit.substr(0, 1).toUpperCase() + unit.substr(1);
      dt['set' + meth](n);
      this.setFromDateObjProxy(dt);
    },
    setUTCAttribute: function (unit, n) {
      if (isNaN(n)) { throw new Error('Units must be a number.'); }
      var meth = unit === 'year' ? 'FullYear' : unit.substr(0, 1).toUpperCase() + unit.substr(1);
      var dt = this.getUTCDateProxy();
      dt['setUTC' + meth](n);
      dt.setUTCMinutes(dt.getUTCMinutes() - this.getTimezoneOffset());
      this.setFromTimeProxy(dt.getTime() + this.getTimezoneOffset() * 60000, this.timezone);
    },
    setTimezone: function (tz) {
      var previousOffset = this.getTimezoneInfo().tzOffset;
      this.timezone = tz;
      this._useCache = false;
      // Set UTC minutes offsets by the delta of the two timezones
      this.setUTCMinutes(this.getUTCMinutes() - this.getTimezoneInfo().tzOffset + previousOffset);
    },
    removeTimezone: function () {
      this.timezone = null;
      this._useCache = false;
    },
    valueOf: function () { return this.getTime(); },
    clone: function () {
      return this.timezone ? new timezoneJS.Date(this.getTime(), this.timezone) : new timezoneJS.Date(this.getTime());
    },
    toGMTString: function () { return this.toString('EEE, dd MMM yyyy HH:mm:ss Z', 'Etc/GMT'); },
    toLocaleString: function () {},
    toLocaleDateString: function () {},
    toLocaleTimeString: function () {},
    toSource: function () {},
    toISOString: function () { return this.toString('yyyy-MM-ddTHH:mm:ss.SSS', 'Etc/UTC') + 'Z'; },
    toJSON: function () { return this.toISOString(); },
    // Allows different format following ISO8601 format:
    toString: function (format, tz) {
      // Default format is the same as toISOString
      if (!format) format = 'yyyy-MM-dd HH:mm:ss';
      var result = format;
      var tzInfo = tz ? timezoneJS.timezone.getTzInfo(this.getTime(), tz) : this.getTimezoneInfo();
      var _this = this;
      // If timezone is specified, get a clone of the current Date object and modify it
      if (tz) {
        _this = this.clone();
        _this.setTimezone(tz);
      }
      var hours = _this.getHours();
      return result
      // fix the same characters in Month names
      .replace(/a+/g, function () { return 'k'; })
      // `y`: year
      .replace(/y+/g, function (token) { return _fixWidth(_this.getFullYear(), token.length); })
      // `d`: date
      .replace(/d+/g, function (token) { return _fixWidth(_this.getDate(), token.length); })
      // `m`: minute
      .replace(/m+/g, function (token) { return _fixWidth(_this.getMinutes(), token.length); })
      // `s`: second
      .replace(/s+/g, function (token) { return _fixWidth(_this.getSeconds(), token.length); })
      // `S`: millisecond
      .replace(/S+/g, function (token) { return _fixWidth(_this.getMilliseconds(), token.length); })
      // `M`: month. Note: `MM` will be the numeric representation (e.g February is 02) but `MMM` will be text representation (e.g February is Feb)
      .replace(/M+/g, function (token) {
        var _month = _this.getMonth(),
        _len = token.length;
        if (_len > 3) {
          return timezoneJS.Months[_month];
        } else if (_len > 2) {
          return timezoneJS.Months[_month].substring(0, _len);
        }
        return _fixWidth(_month + 1, _len);
      })
      // `k`: AM/PM
      .replace(/k+/g, function () {
        if (hours >= 12) {
          if (hours > 12) {
            hours -= 12;
          }
          return 'PM';
        }
        return 'AM';
      })
      // `H`: hour
      .replace(/H+/g, function (token) { return _fixWidth(hours, token.length); })
      // `E`: day
      .replace(/E+/g, function (token) { return DAYS[_this.getDay()].substring(0, token.length); })
      // `Z`: timezone abbreviation
      .replace(/Z+/gi, function () { return tzInfo.tzAbbr; });
    },
    toUTCString: function () { return this.toGMTString(); },
    civilToJulianDayNumber: function (y, m, d) {
      var a;
      // Adjust for zero-based JS-style array
      m++;
      if (m > 12) {
        a = parseInt(m/12, 10);
        m = m % 12;
        y += a;
      }
      if (m <= 2) {
        y -= 1;
        m += 12;
      }
      a = Math.floor(y / 100);
      var b = 2 - a + Math.floor(a / 4)
        , jDt = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524;
      return jDt;
    },
    getLocalOffset: function () {
      return this._dateProxy.getTimezoneOffset();
    }
  };


  timezoneJS.timezone = new function () {
    var _this = this
      , regionMap = {'Etc':'etcetera','EST':'northamerica','MST':'northamerica','HST':'northamerica','EST5EDT':'northamerica','CST6CDT':'northamerica','MST7MDT':'northamerica','PST8PDT':'northamerica','America':'northamerica','Pacific':'australasia','Atlantic':'europe','Africa':'africa','Indian':'africa','Antarctica':'antarctica','Asia':'asia','Australia':'australasia','Europe':'europe','WET':'europe','CET':'europe','MET':'europe','EET':'europe'}
      , regionExceptions = {'Pacific/Honolulu':'northamerica','Atlantic/Bermuda':'northamerica','Atlantic/Cape_Verde':'africa','Atlantic/St_Helena':'africa','Indian/Kerguelen':'antarctica','Indian/Chagos':'asia','Indian/Maldives':'asia','Indian/Christmas':'australasia','Indian/Cocos':'australasia','America/Danmarkshavn':'europe','America/Scoresbysund':'europe','America/Godthab':'europe','America/Thule':'europe','Asia/Yekaterinburg':'europe','Asia/Omsk':'europe','Asia/Novosibirsk':'europe','Asia/Krasnoyarsk':'europe','Asia/Irkutsk':'europe','Asia/Yakutsk':'europe','Asia/Vladivostok':'europe','Asia/Sakhalin':'europe','Asia/Magadan':'europe','Asia/Kamchatka':'europe','Asia/Anadyr':'europe','Africa/Ceuta':'europe','America/Argentina/Buenos_Aires':'southamerica','America/Argentina/Cordoba':'southamerica','America/Argentina/Tucuman':'southamerica','America/Argentina/La_Rioja':'southamerica','America/Argentina/San_Juan':'southamerica','America/Argentina/Jujuy':'southamerica','America/Argentina/Catamarca':'southamerica','America/Argentina/Mendoza':'southamerica','America/Argentina/Rio_Gallegos':'southamerica','America/Argentina/Ushuaia':'southamerica','America/Aruba':'southamerica','America/La_Paz':'southamerica','America/Noronha':'southamerica','America/Belem':'southamerica','America/Fortaleza':'southamerica','America/Recife':'southamerica','America/Araguaina':'southamerica','America/Maceio':'southamerica','America/Bahia':'southamerica','America/Sao_Paulo':'southamerica','America/Campo_Grande':'southamerica','America/Cuiaba':'southamerica','America/Porto_Velho':'southamerica','America/Boa_Vista':'southamerica','America/Manaus':'southamerica','America/Eirunepe':'southamerica','America/Rio_Branco':'southamerica','America/Santiago':'southamerica','Pacific/Easter':'southamerica','America/Bogota':'southamerica','America/Curacao':'southamerica','America/Guayaquil':'southamerica','Pacific/Galapagos':'southamerica','Atlantic/Stanley':'southamerica','America/Cayenne':'southamerica','America/Guyana':'southamerica','America/Asuncion':'southamerica','America/Lima':'southamerica','Atlantic/South_Georgia':'southamerica','America/Paramaribo':'southamerica','America/Port_of_Spain':'southamerica','America/Montevideo':'southamerica','America/Caracas':'southamerica'};
    function invalidTZError(t) { throw new Error('Timezone "' + t + '" is either incorrect, or not loaded in the timezone registry.'); }
    function builtInLoadZoneFile(fileName, opts) {
      var url = _this.zoneFileBasePath + '/' + fileName;
      return !opts || !opts.async
      ? _this.parseZones(_this.transport({ url : url, async : false }))
      : _this.transport({
        async: true,
        url : url,
        success : function (str) {
          if (_this.parseZones(str) && typeof opts.callback === 'function') {
            opts.callback();
          }
          return true;
        },
        error : function () {
          throw new Error('Error retrieving "' + url + '" zoneinfo files');
        }
      });
    }
    function getRegionForTimezone(tz) {
      var exc = regionExceptions[tz]
        , reg
        , ret;
      if (exc) return exc;
      reg = tz.split('/')[0];
      ret = regionMap[reg];
      // If there's nothing listed in the main regions for this TZ, check the 'backward' links
      if (ret) return ret;
      var link = _this.zones[tz];
      if (typeof link === 'string') {
        return getRegionForTimezone(link);
      }
      // Backward-compat file hasn't loaded yet, try looking in there
      if (!_this.loadedZones.backward) {
        // This is for obvious legacy zones (e.g., Iceland) that don't even have a prefix like "America/" that look like normal zones
        _this.loadZoneFile('backward');
        return getRegionForTimezone(tz);
      }
      invalidTZError(tz);
    }
    function parseTimeString(str) {
      var pat = /(\d+)(?::0*(\d*))?(?::0*(\d*))?([wsugz])?$/;
      var hms = str.match(pat);
      hms[1] = parseInt(hms[1], 10);
      hms[2] = hms[2] ? parseInt(hms[2], 10) : 0;
      hms[3] = hms[3] ? parseInt(hms[3], 10) : 0;

      return hms;
    }
    function processZone(z) {
      if (!z[3]) { return; }
      var yea = parseInt(z[3], 10);
      var mon = 11;
      var dat = 31;
      if (z[4]) {
        mon = SHORT_MONTHS[z[4].substr(0, 3)];
        dat = parseInt(z[5], 10) || 1;
      }
      var string = z[6] ? z[6] : '00:00:00'
        , t = parseTimeString(string);
      return [yea, mon, dat, t[1], t[2], t[3]];
    }
    function getZone(dt, tz) {
      var utcMillis = typeof dt === 'number' ? dt : new Date(dt).getTime();
      var t = tz;
      var zoneList = _this.zones[t];
      // Follow links to get to an actual zone
      while (typeof zoneList === "string") {
        t = zoneList;
        zoneList = _this.zones[t];
      }
      if (!zoneList) {
        // Backward-compat file hasn't loaded yet, try looking in there
        if (!_this.loadedZones.backward) {
          //This is for backward entries like "America/Fort_Wayne" that
          // getRegionForTimezone *thinks* it has a region file and zone
          // for (e.g., America => 'northamerica'), but in reality it's a
          // legacy zone we need the backward file for.
          _this.loadZoneFile('backward');
          return getZone(dt, tz);
        }
        invalidTZError(t);
      }
      if (zoneList.length === 0) {
        throw new Error('No Zone found for "' + tz + '" on ' + dt);
      }
      //Do backwards lookup since most use cases deal with newer dates.
      for (var i = zoneList.length - 1; i >= 0; i--) {
        var z = zoneList[i];
        if (z[3] && utcMillis > z[3]) break;
      }
      return zoneList[i+1];
    }
    function getBasicOffset(time) {
      var off = parseTimeString(time)
        , adj = time.charAt(0) === '-' ? -1 : 1;
      off = adj * (((off[1] * 60 + off[2]) * 60 + off[3]) * 1000);
      return off/60/1000;
    }

    //if isUTC is true, date is given in UTC, otherwise it's given
    // in local time (ie. date.getUTC*() returns local time components)
    function getRule(dt, zone, isUTC) {
      var date = typeof dt === 'number' ? new Date(dt) : dt;
      var ruleset = zone[1];
      var basicOffset = zone[0];

      // If the zone has a DST rule like '1:00', create a rule and return it
      // instead of looking it up in the parsed rules
      var staticDstMatch = ruleset.match(/^([0-9]):([0-9][0-9])$/);
      if (staticDstMatch) {
        return [-1000000,'max','-','Jan',1,parseTimeString('0:00'),parseInt(staticDstMatch[1]) * 60 + parseInt(staticDstMatch[2]), '-'];
      }

      //Convert a date to UTC. Depending on the 'type' parameter, the date
      // parameter may be:
      //
      // - `u`, `g`, `z`: already UTC (no adjustment).
      //
      // - `s`: standard time (adjust for time zone offset but not for DST)
      //
    // - `w`: wall clock time (adjust for both time zone and DST offset).
      //
      // DST adjustment is done using the rule given as third argument.
      var convertDateToUTC = function (date, type, rule) {
        var offset = 0;

        if (type === 'u' || type === 'g' || type === 'z') { // UTC
          offset = 0;
        } else if (type === 's') { // Standard Time
          offset = basicOffset;
        } else if (type === 'w' || !type) { // Wall Clock Time
          offset = getAdjustedOffset(basicOffset, rule);
        } else {
          throw("unknown type " + type);
        }
        offset *= 60 * 1000; // to millis

        return new Date(date.getTime() + offset);
      };

      //Step 1:  Find applicable rules for this year.
      //
      //Step 2:  Sort the rules by effective date.
      //
      //Step 3:  Check requested date to see if a rule has yet taken effect this year.  If not,
      //
      //Step 4:  Get the rules for the previous year.  If there isn't an applicable rule for last year, then
      // there probably is no current time offset since they seem to explicitly turn off the offset
      // when someone stops observing DST.
      //
      // FIXME if this is not the case and we'll walk all the way back (ugh).
      //
      //Step 5:  Sort the rules by effective date.
      //Step 6:  Apply the most recent rule before the current time.
      var convertRuleToExactDateAndTime = function (yearAndRule, prevRule) {
        var year = yearAndRule[0]
          , rule = yearAndRule[1];
          // Assume that the rule applies to the year of the given date.

        var hms = rule[5];
        var effectiveDate;

        if (!EXACT_DATE_TIME[year])
          EXACT_DATE_TIME[year] = {};

        // Result for given parameters is already stored
        if (EXACT_DATE_TIME[year][rule])
          effectiveDate = EXACT_DATE_TIME[year][rule];
        else {
          //If we have a specific date, use that!
          if (!isNaN(rule[4])) {
            effectiveDate = new Date(Date.UTC(year, SHORT_MONTHS[rule[3]], rule[4], hms[1], hms[2], hms[3], 0));
          }
          //Let's hunt for the date.
          else {
            var targetDay
              , operator;
            //Example: `lastThu`
            if (rule[4].substr(0, 4) === "last") {
              // Start at the last day of the month and work backward.
              effectiveDate = new Date(Date.UTC(year, SHORT_MONTHS[rule[3]] + 1, 1, hms[1] - 24, hms[2], hms[3], 0));
              targetDay = SHORT_DAYS[rule[4].substr(4, 3)];
              operator = "<=";
            }
            //Example: `Sun>=15`
            else {
              //Start at the specified date.
              effectiveDate = new Date(Date.UTC(year, SHORT_MONTHS[rule[3]], rule[4].substr(5), hms[1], hms[2], hms[3], 0));
              targetDay = SHORT_DAYS[rule[4].substr(0, 3)];
              operator = rule[4].substr(3, 2);
            }
            var ourDay = effectiveDate.getUTCDay();
            //Go forwards.
            if (operator === ">=") {
              effectiveDate.setUTCDate(effectiveDate.getUTCDate() + (targetDay - ourDay + ((targetDay < ourDay) ? 7 : 0)));
            }
            //Go backwards.  Looking for the last of a certain day, or operator is "<=" (less likely).
            else {
              effectiveDate.setUTCDate(effectiveDate.getUTCDate() + (targetDay - ourDay - ((targetDay > ourDay) ? 7 : 0)));
            }
          }
          EXACT_DATE_TIME[year][rule] = effectiveDate;
        }


        //If previous rule is given, correct for the fact that the starting time of the current
        // rule may be specified in local time.
        if (prevRule) {
          effectiveDate = convertDateToUTC(effectiveDate, hms[4], prevRule);
        }
        return effectiveDate;
      };

      var findApplicableRules = function (year, ruleset) {
        var applicableRules = [];
        for (var i = 0; ruleset && i < ruleset.length; i++) {
          //Exclude future rules.
          if (ruleset[i][0] <= year &&
              (
                // Date is in a set range.
                ruleset[i][1] >= year ||
                // Date is in an "only" year.
                  (ruleset[i][0] === year && ruleset[i][1] === "only") ||
                //We're in a range from the start year to infinity.
                    ruleset[i][1] === "max"
          )
             ) {
               //It's completely okay to have any number of matches here.
               // Normally we should only see two, but that doesn't preclude other numbers of matches.
               // These matches are applicable to this year.
               applicableRules.push([year, ruleset[i]]);
             }
        }
        return applicableRules;
      };

      var compareDates = function (a, b, prev) {
        var year, rule;
        if (a.constructor !== Date) {
          year = a[0];
          rule = a[1];
          a = (!prev && EXACT_DATE_TIME[year] && EXACT_DATE_TIME[year][rule])
            ? EXACT_DATE_TIME[year][rule]
            : convertRuleToExactDateAndTime(a, prev);
        } else if (prev) {
          a = convertDateToUTC(a, isUTC ? 'u' : 'w', prev);
        }
        if (b.constructor !== Date) {
          year = b[0];
          rule = b[1];
          b = (!prev && EXACT_DATE_TIME[year] && EXACT_DATE_TIME[year][rule]) ? EXACT_DATE_TIME[year][rule]
            : convertRuleToExactDateAndTime(b, prev);
        } else if (prev) {
          b = convertDateToUTC(b, isUTC ? 'u' : 'w', prev);
        }
        a = Number(a);
        b = Number(b);
        return a - b;
      };

      var year = date.getUTCFullYear();
      var applicableRules;

      applicableRules = findApplicableRules(year, _this.rules[ruleset]);
      applicableRules.push(date);
      //While sorting, the time zone in which the rule starting time is specified
      // is ignored. This is ok as long as the timespan between two DST changes is
      // larger than the DST offset, which is probably always true.
      // As the given date may indeed be close to a DST change, it may get sorted
      // to a wrong position (off by one), which is corrected below.
      applicableRules.sort(compareDates);

      //If there are not enough past DST rules...
      if (_arrIndexOf.call(applicableRules, date) < 2) {
        applicableRules = applicableRules.concat(findApplicableRules(year-1, _this.rules[ruleset]));
        applicableRules.sort(compareDates);
      }
      var pinpoint = _arrIndexOf.call(applicableRules, date);
      if (pinpoint > 1 && compareDates(date, applicableRules[pinpoint-1], applicableRules[pinpoint-2][1]) < 0) {
        //The previous rule does not really apply, take the one before that.
        return applicableRules[pinpoint - 2][1];
      } else if (pinpoint > 0 && pinpoint < applicableRules.length - 1 && compareDates(date, applicableRules[pinpoint+1], applicableRules[pinpoint-1][1]) > 0) {

        //The next rule does already apply, take that one.
        return applicableRules[pinpoint + 1][1];
      } else if (pinpoint === 0) {
        //No applicable rule found in this and in previous year.
        return null;
      }
      return applicableRules[pinpoint - 1][1];
    }
    function getAdjustedOffset(off, rule) {
      return -Math.ceil(rule[6] - off);
    }
    function getAbbreviation(zone, rule) {
      var res;
      var base = zone[2];
      if (base.indexOf('%s') > -1) {
        var repl;
        if (rule) {
          repl = rule[7] === '-' ? '' : rule[7];
        }
        //FIXME: Right now just falling back to Standard --
        // apparently ought to use the last valid rule,
        // although in practice that always ought to be Standard
        else {
          repl = 'S';
        }
        res = base.replace('%s', repl);
      }
      else if (base.indexOf('/') > -1) {
        //Chose one of two alternative strings.
        res = base.split("/", 2)[rule[6] ? 1 : 0];
      } else {
        res = base;
      }
      return res;
    }

    this.zoneFileBasePath = null;
    this.zoneFiles = ['africa', 'antarctica', 'asia', 'australasia', 'backward', 'etcetera', 'europe', 'northamerica', 'pacificnew', 'southamerica'];
    this.loadingSchemes = {
      PRELOAD_ALL: 'preloadAll',
      LAZY_LOAD: 'lazyLoad',
      MANUAL_LOAD: 'manualLoad'
    };
    this.loadingScheme = this.loadingSchemes.LAZY_LOAD;
    this.loadedZones = {};
    this.zones = {};
    this.rules = {};

    this.init = function (o) {
      var opts = { async: true }
        , def = this.loadingScheme === this.loadingSchemes.PRELOAD_ALL
          ? this.zoneFiles
          : (this.defaultZoneFile || 'northamerica')
        , done = 0
        , callbackFn;
      //Override default with any passed-in opts
      for (var p in o) {
        opts[p] = o[p];
      }
      if (typeof def === 'string') {
        return this.loadZoneFile(def, opts);
      }
      //Wraps callback function in another one that makes
      // sure all files have been loaded.
      callbackFn = opts.callback;
      opts.callback = function () {
        done++;
        (done === def.length) && typeof callbackFn === 'function' && callbackFn();
      };
      for (var i = 0; i < def.length; i++) {
        this.loadZoneFile(def[i], opts);
      }
    };

    //Get the zone files via XHR -- if the sync flag
    // is set to true, it's being called by the lazy-loading
    // mechanism, so the result needs to be returned inline.
    this.loadZoneFile = function (fileName, opts) {
      if (typeof this.zoneFileBasePath === 'undefined') {
        throw new Error('Please define a base path to your zone file directory -- timezoneJS.timezone.zoneFileBasePath.');
      }
      //Ignore already loaded zones.
      if (this.loadedZones[fileName]) {
        return;
      }
      this.loadedZones[fileName] = true;
      return builtInLoadZoneFile(fileName, opts);
    };
    this.loadZoneJSONData = function (url, sync) {
      var processData = function (data) {
        data = eval('('+ data +')');
        for (var z in data.zones) {
          _this.zones[z] = data.zones[z];
        }
        for (var r in data.rules) {
          _this.rules[r] = data.rules[r];
        }
      };
      return sync
      ? processData(_this.transport({ url : url, async : false }))
      : _this.transport({ url : url, success : processData });
    };
    this.loadZoneDataFromObject = function (data) {
      if (!data) { return; }
      for (var z in data.zones) {
        _this.zones[z] = data.zones[z];
      }
      for (var r in data.rules) {
        _this.rules[r] = data.rules[r];
      }
    };
    this.getAllZones = function () {
      var arr = [];
      for (var z in this.zones) { arr.push(z); }
      return arr.sort();
    };
    this.parseZones = function (str) {
      var lines = str.split('\n')
        , arr = []
        , chunk = ''
        , l
        , zone = null
        , rule = null;
      for (var i = 0; i < lines.length; i++) {
        l = lines[i];
        if (l.match(/^\s/)) {
          l = "Zone " + zone + l;
        }
        l = l.split("#")[0];
        if (l.length > 3) {
          arr = l.split(/\s+/);
          chunk = arr.shift();
          //Ignore Leap.
          switch (chunk) {
            case 'Zone':
              zone = arr.shift();
              if (!_this.zones[zone]) {
                _this.zones[zone] = [];
              }
              if (arr.length < 3) break;
              //Process zone right here and replace 3rd element with the processed array.
              arr.splice(3, arr.length, processZone(arr));
              if (arr[3]) arr[3] = Date.UTC.apply(null, arr[3]);
              arr[0] = -getBasicOffset(arr[0]);
              _this.zones[zone].push(arr);
              break;
            case 'Rule':
              rule = arr.shift();
              if (!_this.rules[rule]) {
                _this.rules[rule] = [];
              }
              //Parse int FROM year and TO year
              arr[0] = parseInt(arr[0], 10);
              arr[1] = parseInt(arr[1], 10) || arr[1];
              //Parse time string AT
              arr[5] = parseTimeString(arr[5]);
              //Parse offset SAVE
              arr[6] = getBasicOffset(arr[6]);
              _this.rules[rule].push(arr);
              break;
            case 'Link':
              //No zones for these should already exist.
              if (_this.zones[arr[1]]) {
                throw new Error('Error with Link ' + arr[1] + '. Cannot create link of a preexisted zone.');
              }
              //Create the link.
              _this.zones[arr[1]] = arr[0];
              break;
          }
        }
      }
      return true;
    };
    //Expose transport mechanism and allow overwrite.
    this.transport = _transport;
    this.getTzInfo = function (dt, tz, isUTC) {
      //Lazy-load any zones not yet loaded.
      if (this.loadingScheme === this.loadingSchemes.LAZY_LOAD) {
        //Get the correct region for the zone.
        var zoneFile = getRegionForTimezone(tz);
        if (!zoneFile) {
          throw new Error('Not a valid timezone ID.');
        }
        if (!this.loadedZones[zoneFile]) {
          //Get the file and parse it -- use synchronous XHR.
          this.loadZoneFile(zoneFile);
        }
      }
      var z = getZone(dt, tz);
      var off = z[0];
      //See if the offset needs adjustment.
      var rule = getRule(dt, z, isUTC);
      if (rule) {
        off = getAdjustedOffset(off, rule);
      }
      var abbr = getAbbreviation(z, rule);
      return { tzOffset: off, tzAbbr: abbr };
    };
  };
}).call(this);