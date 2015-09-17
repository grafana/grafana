angular.module('ui.bootstrap.dateparser', [])

.service('dateParser', ['$log', '$locale', 'orderByFilter', function($log, $locale, orderByFilter) {
  // Pulled from https://github.com/mbostock/d3/blob/master/src/format/requote.js
  var SPECIAL_CHARACTERS_REGEXP = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g;

  var localeId;
  var formatCodeToRegex;

  this.init = function() {
    localeId = $locale.id;

    this.parsers = {};

    formatCodeToRegex = {
      'yyyy': {
        regex: '\\d{4}',
        apply: function(value) { this.year = +value; }
      },
      'yy': {
        regex: '\\d{2}',
        apply: function(value) { this.year = +value + 2000; }
      },
      'y': {
        regex: '\\d{1,4}',
        apply: function(value) { this.year = +value; }
      },
      'MMMM': {
        regex: $locale.DATETIME_FORMATS.MONTH.join('|'),
        apply: function(value) { this.month = $locale.DATETIME_FORMATS.MONTH.indexOf(value); }
      },
      'MMM': {
        regex: $locale.DATETIME_FORMATS.SHORTMONTH.join('|'),
        apply: function(value) { this.month = $locale.DATETIME_FORMATS.SHORTMONTH.indexOf(value); }
      },
      'MM': {
        regex: '0[1-9]|1[0-2]',
        apply: function(value) { this.month = value - 1; }
      },
      'M': {
        regex: '[1-9]|1[0-2]',
        apply: function(value) { this.month = value - 1; }
      },
      'dd': {
        regex: '[0-2][0-9]{1}|3[0-1]{1}',
        apply: function(value) { this.date = +value; }
      },
      'd': {
        regex: '[1-2]?[0-9]{1}|3[0-1]{1}',
        apply: function(value) { this.date = +value; }
      },
      'EEEE': {
        regex: $locale.DATETIME_FORMATS.DAY.join('|')
      },
      'EEE': {
        regex: $locale.DATETIME_FORMATS.SHORTDAY.join('|')
      },
      'HH': {
        regex: '(?:0|1)[0-9]|2[0-3]',
        apply: function(value) { this.hours = +value; }
      },
      'hh': {
        regex: '0[0-9]|1[0-2]',
        apply: function(value) { this.hours = +value; }
      },
      'H': {
        regex: '1?[0-9]|2[0-3]',
        apply: function(value) { this.hours = +value; }
      },
      'h': {
        regex: '[0-9]|1[0-2]',
        apply: function(value) { this.hours = +value; }
      },
      'mm': {
        regex: '[0-5][0-9]',
        apply: function(value) { this.minutes = +value; }
      },
      'm': {
        regex: '[0-9]|[1-5][0-9]',
        apply: function(value) { this.minutes = +value; }
      },
      'sss': {
        regex: '[0-9][0-9][0-9]',
        apply: function(value) { this.milliseconds = +value; }
      },
      'ss': {
        regex: '[0-5][0-9]',
        apply: function(value) { this.seconds = +value; }
      },
      's': {
        regex: '[0-9]|[1-5][0-9]',
        apply: function(value) { this.seconds = +value; }
      },
      'a': {
        regex: $locale.DATETIME_FORMATS.AMPMS.join('|'),
        apply: function(value) {
          if (this.hours === 12) {
            this.hours = 0;
          }

          if (value === 'PM') {
            this.hours += 12;
          }
        }
      }
    };
  };

  this.init();

  function createParser(format) {
    var map = [], regex = format.split('');

    angular.forEach(formatCodeToRegex, function(data, code) {
      var index = format.indexOf(code);

      if (index > -1) {
        format = format.split('');

        regex[index] = '(' + data.regex + ')';
        format[index] = '$'; // Custom symbol to define consumed part of format
        for (var i = index + 1, n = index + code.length; i < n; i++) {
          regex[i] = '';
          format[i] = '$';
        }
        format = format.join('');

        map.push({ index: index, apply: data.apply });
      }
    });

    return {
      regex: new RegExp('^' + regex.join('') + '$'),
      map: orderByFilter(map, 'index')
    };
  }

  this.parse = function(input, format, baseDate) {
    if (!angular.isString(input) || !format) {
      return input;
    }

    format = $locale.DATETIME_FORMATS[format] || format;
    format = format.replace(SPECIAL_CHARACTERS_REGEXP, '\\$&');

    if ($locale.id !== localeId) {
      this.init();
    }

    if (!this.parsers[format]) {
      this.parsers[format] = createParser(format);
    }

    var parser = this.parsers[format],
        regex = parser.regex,
        map = parser.map,
        results = input.match(regex);

    if (results && results.length) {
      var fields, dt;
      if (angular.isDate(baseDate) && !isNaN(baseDate.getTime())) {
        fields = {
          year: baseDate.getFullYear(),
          month: baseDate.getMonth(),
          date: baseDate.getDate(),
          hours: baseDate.getHours(),
          minutes: baseDate.getMinutes(),
          seconds: baseDate.getSeconds(),
          milliseconds: baseDate.getMilliseconds()
        };
      } else {
        if (baseDate) {
          $log.warn('dateparser:', 'baseDate is not a valid date');
        }
        fields = { year: 1900, month: 0, date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 };
      }

      for (var i = 1, n = results.length; i < n; i++) {
        var mapper = map[i-1];
        if (mapper.apply) {
          mapper.apply.call(fields, results[i]);
        }
      }

      if (isValid(fields.year, fields.month, fields.date)) {
        dt = new Date(fields.year, fields.month, fields.date,
          fields.hours, fields.minutes, fields.seconds,
          fields.milliseconds || 0);
      }

      return dt;
    }
  };

  // Check if date is valid for specific month (and year for February).
  // Month: 0 = Jan, 1 = Feb, etc
  function isValid(year, month, date) {
    if (date < 1) {
      return false;
    }

    if (month === 1 && date > 28) {
      return date === 29 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0);
    }

    if (month === 3 || month === 5 || month === 8 || month === 10) {
      return date < 31;
    }

    return true;
  }
}]);
