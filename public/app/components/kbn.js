define([
  'jquery',
  'lodash',
  'moment'
],
function($, _, moment) {
  'use strict';

  var kbn = {};
  kbn.valueFormats = {};

  kbn.round_interval = function(interval) {
    switch (true) {
    // 0.5s
    case (interval <= 500):
      return 100;       // 0.1s
    // 5s
    case (interval <= 5000):
      return 1000;      // 1s
    // 7.5s
    case (interval <= 7500):
      return 5000;      // 5s
    // 15s
    case (interval <= 15000):
      return 10000;     // 10s
    // 45s
    case (interval <= 45000):
      return 30000;     // 30s
    // 3m
    case (interval <= 180000):
      return 60000;     // 1m
    // 9m
    case (interval <= 450000):
      return 300000;    // 5m
    // 20m
    case (interval <= 1200000):
      return 600000;    // 10m
    // 45m
    case (interval <= 2700000):
      return 1800000;   // 30m
    // 2h
    case (interval <= 7200000):
      return 3600000;   // 1h
    // 6h
    case (interval <= 21600000):
      return 10800000;  // 3h
    // 24h
    case (interval <= 86400000):
      return 43200000;  // 12h
    // 48h
    case (interval <= 172800000):
      return 86400000;  // 24h
    // 1w
    case (interval <= 604800000):
      return 86400000;  // 24h
    // 3w
    case (interval <= 1814400000):
      return 604800000; // 1w
    // 2y
    case (interval < 3628800000):
      return 2592000000; // 30d
    default:
      return 31536000000; // 1y
    }
  };

  kbn.secondsToHms = function(seconds) {
    var numyears = Math.floor(seconds / 31536000);
    if(numyears){
      return numyears + 'y';
    }
    var numdays = Math.floor((seconds % 31536000) / 86400);
    if(numdays){
      return numdays + 'd';
    }
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    if(numhours){
      return numhours + 'h';
    }
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    if(numminutes){
      return numminutes + 'm';
    }
    var numseconds = Math.floor((((seconds % 31536000) % 86400) % 3600) % 60);
    if(numseconds){
      return numseconds + 's';
    }
    var nummilliseconds = Math.floor(seconds * 1000.0);
    if(nummilliseconds){
      return nummilliseconds + 'ms';
    }

    return 'less then a millisecond'; //'just now' //or other string you like;
  };

  kbn.to_percent = function(number,outof) {
    return Math.floor((number/outof)*10000)/100 + "%";
  };

  kbn.addslashes = function(str) {
    str = str.replace(/\\/g, '\\\\');
    str = str.replace(/\'/g, '\\\'');
    str = str.replace(/\"/g, '\\"');
    str = str.replace(/\0/g, '\\0');
    return str;
  };

  kbn.interval_regex = /(\d+(?:\.\d+)?)([Mwdhmsy])/;

  // histogram & trends
  kbn.intervals_in_seconds = {
    y: 31536000,
    M: 2592000,
    w: 604800,
    d: 86400,
    h: 3600,
    m: 60,
    s: 1
  };

  kbn.calculateInterval = function(range, resolution, userInterval) {
    var lowLimitMs = 1; // 1 millisecond default low limit
    var intervalMs, lowLimitInterval;

    if (userInterval) {
      if (userInterval[0] === '>') {
        lowLimitInterval = userInterval.slice(1);
        lowLimitMs = kbn.interval_to_ms(lowLimitInterval);
      }
      else {
        return userInterval;
      }
    }

    intervalMs = kbn.round_interval((range.to.valueOf() - range.from.valueOf()) / resolution);
    if (lowLimitMs > intervalMs) {
      intervalMs = lowLimitMs;
    }

    return kbn.secondsToHms(intervalMs / 1000);
  };

  kbn.describe_interval = function (string) {
    var matches = string.match(kbn.interval_regex);
    if (!matches || !_.has(kbn.intervals_in_seconds, matches[2])) {
      throw new Error('Invalid interval string, expexcting a number followed by one of "Mwdhmsy"');
    } else {
      return {
        sec: kbn.intervals_in_seconds[matches[2]],
        type: matches[2],
        count: parseInt(matches[1], 10)
      };
    }
  };

  kbn.interval_to_ms = function(string) {
    var info = kbn.describe_interval(string);
    return info.sec * 1000 * info.count;
  };

  kbn.interval_to_seconds = function (string) {
    var info = kbn.describe_interval(string);
    return info.sec * info.count;
  };

  /* This is a simplified version of elasticsearch's date parser */
  kbn.parseDate = function(text) {
    if(_.isDate(text)) {
      return text;
    }

    var time;
    var mathString = "";
    var index;
    var parseString;

    if (text.substring(0,3) === "now") {
      time = new Date();
      mathString = text.substring(3);
    }
    else if (text.substring(0,5) === 'today') {
      time = new Date();
      time.setHours(0,0,0,0);
      mathString = text.substring(5);
    }
    else {
      index = text.indexOf("||");
      parseString;
      if (index === -1) {
        parseString = text;
        mathString = ""; // nothing else
      } else {
        parseString = text.substring(0, index);
        mathString = text.substring(index + 2);
      }
      // We're going to just require ISO8601 timestamps, k?
      time = new Date(parseString);
    }

    if (!mathString.length) {
      return time;
    }

    //return [time,parseString,mathString];
    return kbn.parseDateMath(mathString, time);
  };

  kbn._timespanRegex = /^\d+[h,m,M,w,s,H,d]$/;
  kbn.isValidTimeSpan = function(str) {
    return kbn._timespanRegex.test(str);
  };

  kbn.parseDateMath = function(mathString, time, roundUp) {
    var dateTime = moment(time);
    for (var i = 0; i < mathString.length;) {
      var c = mathString.charAt(i++),
        type,
        num,
        unit;
      if (c === '/') {
        type = 0;
      } else if (c === '+') {
        type = 1;
      } else if (c === '-') {
        type = 2;
      } else {
        return false;
      }

      if (isNaN(mathString.charAt(i))) {
        num = 1;
      } else {
        var numFrom = i;
        while (!isNaN(mathString.charAt(i))) {
          i++;
        }
        num = parseInt(mathString.substring(numFrom, i),10);
      }
      if (type === 0) {
        // rounding is only allowed on whole numbers
        if (num !== 1) {
          return false;
        }
      }
      unit = mathString.charAt(i++);
      switch (unit) {
      case 'y':
        if (type === 0) {
          roundUp ? dateTime.endOf('year') : dateTime.startOf('year');
        } else if (type === 1) {
          dateTime.add(num, 'years');
        } else if (type === 2) {
          dateTime.subtract(num, 'years');
        }
        break;
      case 'M':
        if (type === 0) {
          roundUp ? dateTime.endOf('month') : dateTime.startOf('month');
        } else if (type === 1) {
          dateTime.add(num, 'months');
        } else if (type === 2) {
          dateTime.subtract(num, 'months');
        }
        break;
      case 'w':
        if (type === 0) {
          roundUp ? dateTime.endOf('week') : dateTime.startOf('week');
        } else if (type === 1) {
          dateTime.add(num, 'weeks');
        } else if (type === 2) {
          dateTime.subtract(num, 'weeks');
        }
        break;
      case 'd':
        if (type === 0) {
          roundUp ? dateTime.endOf('day') : dateTime.startOf('day');
        } else if (type === 1) {
          dateTime.add(num, 'days');
        } else if (type === 2) {
          dateTime.subtract(num, 'days');
        }
        break;
      case 'h':
      case 'H':
        if (type === 0) {
          roundUp ? dateTime.endOf('hour') : dateTime.startOf('hour');
        } else if (type === 1) {
          dateTime.add(num, 'hours');
        } else if (type === 2) {
          dateTime.subtract(num,'hours');
        }
        break;
      case 'm':
        if (type === 0) {
          roundUp ? dateTime.endOf('minute') : dateTime.startOf('minute');
        } else if (type === 1) {
          dateTime.add(num, 'minutes');
        } else if (type === 2) {
          dateTime.subtract(num, 'minutes');
        }
        break;
      case 's':
        if (type === 0) {
          roundUp ? dateTime.endOf('second') : dateTime.startOf('second');
        } else if (type === 1) {
          dateTime.add(num, 'seconds');
        } else if (type === 2) {
          dateTime.subtract(num, 'seconds');
        }
        break;
      default:
        return false;
      }
    }
    return dateTime.toDate();
  };

  kbn.query_color_dot = function (color, diameter) {
    return '<div class="icon-circle" style="' + [
      'display:inline-block',
      'color:' + color,
      'font-size:' + diameter + 'px',
    ].join(';') + '"></div>';
  };

  kbn.valueFormats.percent = function(size, decimals) {
    return kbn.toFixed(size, decimals) + '%';
  };

  kbn.formatFuncCreator = function(factor, extArray) {
    return function(size, decimals, scaledDecimals) {
      if (size === null) {
        return "";
      }

      var steps = 0;
      var limit = extArray.length;

      while (Math.abs(size) >= factor) {
        steps++;
        size /= factor;

        if (steps >= limit) { return "NA"; }
      }

      if (steps > 0 && scaledDecimals !== null) {
        decimals = scaledDecimals + (3 * steps);
      }

      return kbn.toFixed(size, decimals) + extArray[steps];
    };
  };

  kbn.toFixed = function(value, decimals) {
    if (value === null) {
      return "";
    }

    var factor = decimals ? Math.pow(10, Math.max(0, decimals)) : 1;
    var formatted = String(Math.round(value * factor) / factor);

    // if exponent return directly
    if (formatted.indexOf('e') !== -1 || value === 0) {
      return formatted;
    }

    // If tickDecimals was specified, ensure that we have exactly that
    // much precision; otherwise default to the value's own precision.
    if (decimals != null) {
      var decimalPos = formatted.indexOf(".");
      var precision = decimalPos === -1 ? 0 : formatted.length - decimalPos - 1;
      if (precision < decimals) {
        return (precision ? formatted : formatted + ".") + (String(factor)).substr(1, decimals - precision);
      }
    }

    return formatted;
  };

  kbn.valueFormats.bits = kbn.formatFuncCreator(1024, [' b', ' Kib', ' Mib', ' Gib', ' Tib', ' Pib', ' Eib', ' Zib', ' Yib']);
  kbn.valueFormats.bytes = kbn.formatFuncCreator(1024, [' B', ' KiB', ' MiB', ' GiB', ' TiB', ' PiB', ' EiB', ' ZiB', ' YiB']);
  kbn.valueFormats.kbytes = kbn.formatFuncCreator(1024, [' KiB', ' MiB', ' GiB', ' TiB', ' PiB', ' EiB', ' ZiB', ' YiB']);
  kbn.valueFormats.mbytes = kbn.formatFuncCreator(1024, [' MiB', ' GiB', ' TiB', ' PiB', ' EiB', ' ZiB', ' YiB']);
  kbn.valueFormats.gbytes = kbn.formatFuncCreator(1024, [' GiB', ' TiB', ' PiB', ' EiB', ' ZiB', ' YiB']);
  kbn.valueFormats.bps = kbn.formatFuncCreator(1000, [' bps', ' Kbps', ' Mbps', ' Gbps', ' Tbps', ' Pbps', ' Ebps', ' Zbps', ' Ybps']);
  kbn.valueFormats.pps = kbn.formatFuncCreator(1000, [' pps', ' Kpps', ' Mpps', ' Gpps', ' Tpps', ' Ppps', ' Epps', ' Zpps', ' Ypps']);
  kbn.valueFormats.Bps = kbn.formatFuncCreator(1000, [' Bps', ' KBps', ' MBps', ' GBps', ' TBps', ' PBps', ' EBps', ' ZBps', ' YBps']);
  kbn.valueFormats.short = kbn.formatFuncCreator(1000, ['', ' K', ' Mil', ' Bil', ' Tri', ' Quadr', ' Quint', ' Sext', ' Sept']);
  kbn.valueFormats.joule = kbn.formatFuncCreator(1000, [' J', ' kJ', ' MJ', ' GJ', ' TJ', ' PJ', ' EJ', ' ZJ', ' YJ']);
  kbn.valueFormats.amp = kbn.formatFuncCreator(1000, [' A', ' kA', ' MA', ' GA', ' TA', ' PA', ' EA', ' ZA', ' YA']);
  kbn.valueFormats.volt = kbn.formatFuncCreator(1000, [' V', ' kV', ' MV', ' GV', ' TV', ' PV', ' EV', ' ZV', ' YV']);
  kbn.valueFormats.hertz = kbn.formatFuncCreator(1000, [' Hz', ' kHz', ' MHz', ' GHz', ' THz', ' PHz', ' EHz', ' ZHz', ' YHz']);
  kbn.valueFormats.watt = kbn.formatFuncCreator(1000, [' W', ' kW', ' MW', ' GW', ' TW', ' PW', ' EW', ' ZW', ' YW']);
  kbn.valueFormats.kwatt = kbn.formatFuncCreator(1000, [' kW', ' MW', ' GW', ' TW', ' PW', ' EW', ' ZW', ' YW']);
  kbn.valueFormats.watth = kbn.formatFuncCreator(1000, [' Wh', ' kWh', ' MWh', ' GWh', ' TWh', ' PWh', ' EWh', ' ZWh', ' YWh']);
  kbn.valueFormats.kwatth = kbn.formatFuncCreator(1000, [' kWh', ' MWh', ' GWh', ' TWh', ' PWh', ' EWh', ' ZWh', ' YWh']);
  kbn.valueFormats.ev = kbn.formatFuncCreator(1000, [' eV', ' keV', ' MeV', 'GeV', 'TeV', 'PeV', 'EeV', 'ZeV', 'YeV']);
  kbn.valueFormats.none = kbn.toFixed;
  kbn.valueFormats.celsius = function(value, decimals) { return kbn.toFixed(value, decimals) + ' °C'; };
  kbn.valueFormats.farenheit = function(value, decimals) { return kbn.toFixed(value, decimals) + ' °F'; };
  kbn.valueFormats.humidity = function(value, decimals) { return kbn.toFixed(value, decimals) + ' %H'; };
  kbn.valueFormats.ppm = function(value, decimals) { return kbn.toFixed(value, decimals) + ' ppm'; };
  kbn.valueFormats.velocityms = function(value, decimals) { return kbn.toFixed(value, decimals) + ' m/s'; };
  kbn.valueFormats.velocitykmh = function(value, decimals) { return kbn.toFixed(value, decimals) + ' km/h'; };
  kbn.valueFormats.velocitymph = function(value, decimals) { return kbn.toFixed(value, decimals) + ' mph'; };
  kbn.valueFormats.velocityknot = function(value, decimals) { return kbn.toFixed(value, decimals) + ' kn'; };

  kbn.roundValue = function (num, decimals) {
    var n = Math.pow(10, decimals);
    return Math.round((n * num).toFixed(decimals))  / n;
  };

  kbn.toFixedScaled = function(value, decimals, scaledDecimals, additionalDecimals, ext) {
    if (scaledDecimals === null) {
      return kbn.toFixed(value, decimals) + ext;
    } else {
      return kbn.toFixed(value, scaledDecimals + additionalDecimals) + ext;
    }
  };

  kbn.valueFormats.ms = function(size, decimals, scaledDecimals) {
    if (size === null) { return ""; }

    if (Math.abs(size) < 1000) {
      return kbn.toFixed(size, decimals) + " ms";
    }
    // Less than 1 min
    else if (Math.abs(size) < 60000) {
      return kbn.toFixedScaled(size / 1000, decimals, scaledDecimals, 3, " s");
    }
    // Less than 1 hour, devide in minutes
    else if (Math.abs(size) < 3600000) {
      return kbn.toFixedScaled(size / 60000, decimals, scaledDecimals, 5, " min");
    }
    // Less than one day, devide in hours
    else if (Math.abs(size) < 86400000) {
      return kbn.toFixedScaled(size / 3600000, decimals, scaledDecimals, 7, " hour");
    }
    // Less than one year, devide in days
    else if (Math.abs(size) < 31536000000) {
      return kbn.toFixedScaled(size / 86400000, decimals, scaledDecimals, 8, " day");
    }

    return kbn.toFixedScaled(size / 31536000000, decimals, scaledDecimals, 10, " year");
  };

  kbn.valueFormats.s = function(size, decimals, scaledDecimals) {
    if (size === null) { return ""; }

    if (Math.abs(size) < 600) {
      return kbn.toFixed(size, decimals) + " s";
    }
    // Less than 1 hour, devide in minutes
    else if (Math.abs(size) < 3600) {
      return kbn.toFixedScaled(size / 60, decimals, scaledDecimals, 1, " min");
    }
    // Less than one day, devide in hours
    else if (Math.abs(size) < 86400) {
      return kbn.toFixedScaled(size / 3600, decimals, scaledDecimals, 4, " hour");
    }
    // Less than one week, devide in days
    else if (Math.abs(size) < 604800) {
      return kbn.toFixedScaled(size / 86400, decimals, scaledDecimals, 5, " day");
    }
    // Less than one year, devide in week
    else if (Math.abs(size) < 31536000) {
      return kbn.toFixedScaled(size / 604800, decimals, scaledDecimals, 6, " week");
    }

    return kbn.toFixedScaled(size / 3.15569e7, decimals, scaledDecimals, 7, " year");
  };

  kbn.valueFormats['µs'] = function(size, decimals, scaledDecimals) {
    if (size === null) { return ""; }

    if (Math.abs(size) < 1000) {
      return kbn.toFixed(size, decimals) + " µs";
    }
    else if (Math.abs(size) < 1000000) {
      return kbn.toFixedScaled(size / 1000, decimals, scaledDecimals, 3, " ms");
    }
    else {
      return kbn.toFixedScaled(size / 1000000, decimals, scaledDecimals, 6, " s");
    }
  };

  kbn.valueFormats.ns = function(size, decimals, scaledDecimals) {
    if (size === null) { return ""; }

    if (Math.abs(size) < 1000) {
      return kbn.toFixed(size, decimals) + " ns";
    }
    else if (Math.abs(size) < 1000000) {
      return kbn.toFixedScaled(size / 1000, decimals, scaledDecimals, 3, " µs");
    }
    else if (Math.abs(size) < 1000000000) {
      return kbn.toFixedScaled(size / 1000000, decimals, scaledDecimals, 6, " ms");
    }
    else if (Math.abs(size) < 60000000000){
      return kbn.toFixedScaled(size / 1000000000, decimals, scaledDecimals, 9, " s");
    }
    else {
      return kbn.toFixedScaled(size / 60000000000, decimals, scaledDecimals, 12, " min");
    }
  };

  kbn.slugifyForUrl = function(str) {
    return str
      .toLowerCase()
      .replace(/[^\w ]+/g,'')
      .replace(/ +/g,'-');
  };

  kbn.exportSeriesListToCsv = function(seriesList) {
    var text = 'Series;Time;Value\n';
    _.each(seriesList, function(series) {
      _.each(series.datapoints, function(dp) {
        text += series.alias + ';' + new Date(dp[1]).toISOString() + ';' + dp[0] + '\n';
      });
    });
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    window.saveAs(blob, 'grafana_data_export.csv');
  };

  kbn.stringToJsRegex = function(str) {
    if (str[0] !== '/') {
      return new RegExp(str);
    }

    var match = str.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
    return new RegExp(match[1], match[2]);
  };

  kbn.getUnitFormats = function() {
    return [
      {
        text: 'none',
        submenu: [
          {text: 'none' , value: 'none'},
          {text: 'short', value: 'short'},
          {text: 'percent', value: 'percent'},
          {text: 'ppm', value: 'ppm'},
        ]
      },
      {
        text: 'duration',
        submenu: [
          {text: 'nanoseconds (ns)' , value: 'ns'},
          {text: 'microseconds (µs)', value: 'µs'},
          {text: 'milliseconds (ms)', value: 'ms'},
          {text: 'seconds (s)', value: 's'},
          {text: 'Hertz (1/s)', value: 'hertz'},
        ]
      },
      {
        text: 'data',
        submenu: [
          {text: 'bits', value: 'bits'},
          {text: 'bytes', value: 'bytes'},
          {text: 'kilobytes', value: 'kbytes'},
          {text: 'megabytes', value: 'mbytes'},
          {text: 'gigabytes', value: 'gbytes'},
        ]
      },
      {
        text: 'data rate',
        submenu: [
          {text: 'packets/sec', value: 'pps'},
          {text: 'bits/sec', value: 'bps'},
          {text: 'bytes/sec', value: 'Bps'},
        ]
      },
      {
        text: 'energy',
        submenu: [
          {text: 'watt (W)',              value: 'watt'},
          {text: 'kilowatt (kW)',         value: 'kwatt'},
          {text: 'watt-hour (Wh)',        value: 'watth'},
          {text: 'kilowatt-hour (kWh)',   value: 'kwatth'},
          {text: 'joule (J)',             value: 'joule'},
          {text: 'electron volt (eV)',    value: 'ev'},
          {text: 'Ampere (A)',            value: 'amp'},
          {text: 'Volt (V)',              value: 'volt'},
        ]
      },
      {
        text: 'weather',
        submenu: [
          {text: 'Celcius (°C)',         value: 'celsius'  },
          {text: 'Farenheit (°F)',       value: 'farenheit'},
          {text: 'Humidity (%H)',        value: 'humidity' },
        ]
      },
      {
        text: 'velocity',
        submenu: [
          {text: 'm/s',  value: 'velocityms'  },
          {text: 'km/h', value: 'velocitykmh'  },
          {text: 'mph',  value: 'velocitymph'  },
          {text: 'knot (kn)', value: 'velocityknot'  },
        ]
      },
    ];
  };

  return kbn;
});
