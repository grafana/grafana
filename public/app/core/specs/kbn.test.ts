import kbn from '../utils/kbn';
import * as dateMath from '../utils/datemath';
import moment from 'moment';

describe('unit format menu', function() {
  var menu = kbn.getUnitFormats();
  menu.map(function(submenu) {
    describe('submenu ' + submenu.text, function() {
      it('should have a title', function() {
        expect(typeof submenu.text).toBe('string');
      });

      it('should have a submenu', function() {
        expect(Array.isArray(submenu.submenu)).toBe(true);
      });

      submenu.submenu.map(function(entry) {
        describe('entry ' + entry.text, function() {
          it('should have a title', function() {
            expect(typeof entry.text).toBe('string');
          });
          it('should have a format', function() {
            expect(typeof entry.value).toBe('string');
          });
          it('should have a valid format', function() {
            expect(typeof kbn.valueFormats[entry.value]).toBe('function');
          });
        });
      });
    });
  });
});

function describeValueFormat(desc, value, tickSize, tickDecimals, result) {
  describe('value format: ' + desc, function() {
    it('should translate ' + value + ' as ' + result, function() {
      var scaledDecimals = tickDecimals - Math.floor(Math.log(tickSize) / Math.LN10);
      var str = kbn.valueFormats[desc](value, tickDecimals, scaledDecimals);
      expect(str).toBe(result);
    });
  });
}

describeValueFormat('ms', 0.0024, 0.0005, 4, '0.0024 ms');
describeValueFormat('ms', 100, 1, 0, '100 ms');
describeValueFormat('ms', 1250, 10, 0, '1.25 s');
describeValueFormat('ms', 1250, 300, 0, '1.3 s');
describeValueFormat('ms', 65150, 10000, 0, '1.1 min');
describeValueFormat('ms', 6515000, 1500000, 0, '1.8 hour');
describeValueFormat('ms', 651500000, 150000000, 0, '8 day');

describeValueFormat('none', 2.75e-10, 0, 10, '3e-10');
describeValueFormat('none', 0, 0, 2, '0');
describeValueFormat('dB', 10, 1000, 2, '10.00 dB');

describeValueFormat('percent', 0, 0, 0, '0%');
describeValueFormat('percent', 53, 0, 1, '53.0%');
describeValueFormat('percentunit', 0.0, 0, 0, '0%');
describeValueFormat('percentunit', 0.278, 0, 1, '27.8%');
describeValueFormat('percentunit', 1.0, 0, 0, '100%');

describeValueFormat('currencyUSD', 7.42, 10000, 2, '$7.42');
describeValueFormat('currencyUSD', 1532.82, 1000, 1, '$1.53K');
describeValueFormat('currencyUSD', 18520408.7, 10000000, 0, '$19M');

describeValueFormat('bytes', -1.57e308, -1.57e308, 2, 'NA');

describeValueFormat('ns', 25, 1, 0, '25 ns');
describeValueFormat('ns', 2558, 50, 0, '2.56 µs');

describeValueFormat('ops', 123, 1, 0, '123 ops');
describeValueFormat('rps', 456000, 1000, -1, '456K rps');
describeValueFormat('rps', 123456789, 1000000, 2, '123.457M rps');
describeValueFormat('wps', 789000000, 1000000, -1, '789M wps');
describeValueFormat('iops', 11000000000, 1000000000, -1, '11B iops');

describeValueFormat('s', 1.23456789e-7, 1e-10, 8, '123.5 ns');
describeValueFormat('s', 1.23456789e-4, 1e-7, 5, '123.5 µs');
describeValueFormat('s', 1.23456789e-3, 1e-6, 4, '1.235 ms');
describeValueFormat('s', 1.23456789e-2, 1e-5, 3, '12.35 ms');
describeValueFormat('s', 1.23456789e-1, 1e-4, 2, '123.5 ms');
describeValueFormat('s', 24, 1, 0, '24 s');
describeValueFormat('s', 246, 1, 0, '4.1 min');
describeValueFormat('s', 24567, 100, 0, '6.82 hour');
describeValueFormat('s', 24567890, 10000, 0, '40.62 week');
describeValueFormat('s', 24567890000, 1000000, 0, '778.53 year');

describeValueFormat('m', 24, 1, 0, '24 min');
describeValueFormat('m', 246, 10, 0, '4.1 hour');
describeValueFormat('m', 6545, 10, 0, '4.55 day');
describeValueFormat('m', 24567, 100, 0, '2.44 week');
describeValueFormat('m', 24567892, 10000, 0, '46.7 year');

describeValueFormat('h', 21, 1, 0, '21 hour');
describeValueFormat('h', 145, 1, 0, '6.04 day');
describeValueFormat('h', 1234, 100, 0, '7.3 week');
describeValueFormat('h', 9458, 1000, 0, '1.08 year');

describeValueFormat('d', 3, 1, 0, '3 day');
describeValueFormat('d', 245, 100, 0, '35 week');
describeValueFormat('d', 2456, 10, 0, '6.73 year');

describe('date time formats', function() {
  const epoch = 1505634997920;
  const utcTime = moment.utc(epoch);
  const browserTime = moment(epoch);

  it('should format as iso date', function() {
    var expected = browserTime.format('YYYY-MM-DD HH:mm:ss');
    var actual = kbn.valueFormats.dateTimeAsIso(epoch);
    expect(actual).toBe(expected);
  });

  it('should format as iso date (in UTC)', function() {
    var expected = utcTime.format('YYYY-MM-DD HH:mm:ss');
    var actual = kbn.valueFormats.dateTimeAsIso(epoch, true);
    expect(actual).toBe(expected);
  });

  it('should format as iso date and skip date when today', function() {
    var now = moment();
    var expected = now.format('HH:mm:ss');
    var actual = kbn.valueFormats.dateTimeAsIso(now.valueOf(), false);
    expect(actual).toBe(expected);
  });

  it('should format as iso date (in UTC) and skip date when today', function() {
    var now = moment.utc();
    var expected = now.format('HH:mm:ss');
    var actual = kbn.valueFormats.dateTimeAsIso(now.valueOf(), true);
    expect(actual).toBe(expected);
  });

  it('should format as US date', function() {
    var expected = browserTime.format('MM/DD/YYYY h:mm:ss a');
    var actual = kbn.valueFormats.dateTimeAsUS(epoch, false);
    expect(actual).toBe(expected);
  });

  it('should format as US date (in UTC)', function() {
    var expected = utcTime.format('MM/DD/YYYY h:mm:ss a');
    var actual = kbn.valueFormats.dateTimeAsUS(epoch, true);
    expect(actual).toBe(expected);
  });

  it('should format as US date and skip date when today', function() {
    var now = moment();
    var expected = now.format('h:mm:ss a');
    var actual = kbn.valueFormats.dateTimeAsUS(now.valueOf(), false);
    expect(actual).toBe(expected);
  });

  it('should format as US date (in UTC) and skip date when today', function() {
    var now = moment.utc();
    var expected = now.format('h:mm:ss a');
    var actual = kbn.valueFormats.dateTimeAsUS(now.valueOf(), true);
    expect(actual).toBe(expected);
  });

  it('should format as from now with days', function() {
    var daysAgo = moment().add(-7, 'd');
    var expected = '7 days ago';
    var actual = kbn.valueFormats.dateTimeFromNow(daysAgo.valueOf(), false);
    expect(actual).toBe(expected);
  });

  it('should format as from now with days (in UTC)', function() {
    var daysAgo = moment.utc().add(-7, 'd');
    var expected = '7 days ago';
    var actual = kbn.valueFormats.dateTimeFromNow(daysAgo.valueOf(), true);
    expect(actual).toBe(expected);
  });

  it('should format as from now with minutes', function() {
    var daysAgo = moment().add(-2, 'm');
    var expected = '2 minutes ago';
    var actual = kbn.valueFormats.dateTimeFromNow(daysAgo.valueOf(), false);
    expect(actual).toBe(expected);
  });

  it('should format as from now with minutes (in UTC)', function() {
    var daysAgo = moment.utc().add(-2, 'm');
    var expected = '2 minutes ago';
    var actual = kbn.valueFormats.dateTimeFromNow(daysAgo.valueOf(), true);
    expect(actual).toBe(expected);
  });
});

describe('kbn.toFixed and negative decimals', function() {
  it('should treat as zero decimals', function() {
    var str = kbn.toFixed(186.123, -2);
    expect(str).toBe('186');
  });
});

describe('kbn ms format when scaled decimals is null do not use it', function() {
  it('should use specified decimals', function() {
    var str = kbn.valueFormats['ms'](10000086.123, 1, null);
    expect(str).toBe('2.8 hour');
  });
});

describe('kbn kbytes format when scaled decimals is null do not use it', function() {
  it('should use specified decimals', function() {
    var str = kbn.valueFormats['kbytes'](10000000, 3, null);
    expect(str).toBe('9.537 GiB');
  });
});

describe('kbn deckbytes format when scaled decimals is null do not use it', function() {
  it('should use specified decimals', function() {
    var str = kbn.valueFormats['deckbytes'](10000000, 3, null);
    expect(str).toBe('10.000 GB');
  });
});

describe('kbn roundValue', function() {
  it('should should handle null value', function() {
    var str = kbn.roundValue(null, 2);
    expect(str).toBe(null);
  });
  it('should round value', function() {
    var str = kbn.roundValue(200.877, 2);
    expect(str).toBe(200.88);
  });
});

describe('calculateInterval', function() {
  it('1h 100 resultion', function() {
    var range = { from: dateMath.parse('now-1h'), to: dateMath.parse('now') };
    var res = kbn.calculateInterval(range, 100, null);
    expect(res.interval).toBe('30s');
  });

  it('10m 1600 resolution', function() {
    var range = { from: dateMath.parse('now-10m'), to: dateMath.parse('now') };
    var res = kbn.calculateInterval(range, 1600, null);
    expect(res.interval).toBe('500ms');
    expect(res.intervalMs).toBe(500);
  });

  it('fixed user min interval', function() {
    var range = { from: dateMath.parse('now-10m'), to: dateMath.parse('now') };
    var res = kbn.calculateInterval(range, 1600, '10s');
    expect(res.interval).toBe('10s');
    expect(res.intervalMs).toBe(10000);
  });

  it('short time range and user low limit', function() {
    var range = { from: dateMath.parse('now-10m'), to: dateMath.parse('now') };
    var res = kbn.calculateInterval(range, 1600, '>10s');
    expect(res.interval).toBe('10s');
  });

  it('large time range and user low limit', function() {
    var range = { from: dateMath.parse('now-14d'), to: dateMath.parse('now') };
    var res = kbn.calculateInterval(range, 1000, '>10s');
    expect(res.interval).toBe('20m');
  });

  it('10s 900 resolution and user low limit in ms', function() {
    var range = { from: dateMath.parse('now-10s'), to: dateMath.parse('now') };
    var res = kbn.calculateInterval(range, 900, '>15ms');
    expect(res.interval).toBe('15ms');
  });

  it('1d 1 resolution', function() {
    var range = { from: dateMath.parse('now-1d'), to: dateMath.parse('now') };
    var res = kbn.calculateInterval(range, 1, null);
    expect(res.interval).toBe('1d');
    expect(res.intervalMs).toBe(86400000);
  });

  it('86399s 1 resolution', function() {
    var range = {
      from: dateMath.parse('now-86390s'),
      to: dateMath.parse('now'),
    };
    var res = kbn.calculateInterval(range, 1, null);
    expect(res.interval).toBe('12h');
    expect(res.intervalMs).toBe(43200000);
  });
});

describe('hex', function() {
  it('positive integer', function() {
    var str = kbn.valueFormats.hex(100, 0);
    expect(str).toBe('64');
  });
  it('negative integer', function() {
    var str = kbn.valueFormats.hex(-100, 0);
    expect(str).toBe('-64');
  });
  it('null', function() {
    var str = kbn.valueFormats.hex(null, 0);
    expect(str).toBe('');
  });
  it('positive float', function() {
    var str = kbn.valueFormats.hex(50.52, 1);
    expect(str).toBe('32.8');
  });
  it('negative float', function() {
    var str = kbn.valueFormats.hex(-50.333, 2);
    expect(str).toBe('-32.547AE147AE14');
  });
});

describe('hex 0x', function() {
  it('positive integeter', function() {
    var str = kbn.valueFormats.hex0x(7999, 0);
    expect(str).toBe('0x1F3F');
  });
  it('negative integer', function() {
    var str = kbn.valueFormats.hex0x(-584, 0);
    expect(str).toBe('-0x248');
  });
  it('null', function() {
    var str = kbn.valueFormats.hex0x(null, 0);
    expect(str).toBe('');
  });
  it('positive float', function() {
    var str = kbn.valueFormats.hex0x(74.443, 3);
    expect(str).toBe('0x4A.716872B020C4');
  });
  it('negative float', function() {
    var str = kbn.valueFormats.hex0x(-65.458, 1);
    expect(str).toBe('-0x41.8');
  });
});

describe('duration', function() {
  it('null', function() {
    var str = kbn.toDuration(null, 0, 'millisecond');
    expect(str).toBe('');
  });
  it('0 milliseconds', function() {
    var str = kbn.toDuration(0, 0, 'millisecond');
    expect(str).toBe('0 milliseconds');
  });
  it('1 millisecond', function() {
    var str = kbn.toDuration(1, 0, 'millisecond');
    expect(str).toBe('1 millisecond');
  });
  it('-1 millisecond', function() {
    var str = kbn.toDuration(-1, 0, 'millisecond');
    expect(str).toBe('1 millisecond ago');
  });
  it('seconds', function() {
    var str = kbn.toDuration(1, 0, 'second');
    expect(str).toBe('1 second');
  });
  it('minutes', function() {
    var str = kbn.toDuration(1, 0, 'minute');
    expect(str).toBe('1 minute');
  });
  it('hours', function() {
    var str = kbn.toDuration(1, 0, 'hour');
    expect(str).toBe('1 hour');
  });
  it('days', function() {
    var str = kbn.toDuration(1, 0, 'day');
    expect(str).toBe('1 day');
  });
  it('weeks', function() {
    var str = kbn.toDuration(1, 0, 'week');
    expect(str).toBe('1 week');
  });
  it('months', function() {
    var str = kbn.toDuration(1, 0, 'month');
    expect(str).toBe('1 month');
  });
  it('years', function() {
    var str = kbn.toDuration(1, 0, 'year');
    expect(str).toBe('1 year');
  });
  it('decimal days', function() {
    var str = kbn.toDuration(1.5, 2, 'day');
    expect(str).toBe('1 day, 12 hours, 0 minutes');
  });
  it('decimal months', function() {
    var str = kbn.toDuration(1.5, 3, 'month');
    expect(str).toBe('1 month, 2 weeks, 1 day, 0 hours');
  });
  it('no decimals', function() {
    var str = kbn.toDuration(38898367008, 0, 'millisecond');
    expect(str).toBe('1 year');
  });
  it('1 decimal', function() {
    var str = kbn.toDuration(38898367008, 1, 'millisecond');
    expect(str).toBe('1 year, 2 months');
  });
  it('too many decimals', function() {
    var str = kbn.toDuration(38898367008, 20, 'millisecond');
    expect(str).toBe('1 year, 2 months, 3 weeks, 4 days, 5 hours, 6 minutes, 7 seconds, 8 milliseconds');
  });
  it('floating point error', function() {
    var str = kbn.toDuration(36993906007, 8, 'millisecond');
    expect(str).toBe('1 year, 2 months, 0 weeks, 3 days, 4 hours, 5 minutes, 6 seconds, 7 milliseconds');
  });
});

describe('volume', function() {
  it('1000m3', function() {
    var str = kbn.valueFormats['m3'](1000, 1, null);
    expect(str).toBe('1000.0 m³');
  });
});

describe('hh:mm:ss', function() {
  it('00:04:06', function() {
    var str = kbn.valueFormats['dthms'](246, 1);
    expect(str).toBe('00:04:06');
  });
  it('24:00:00', function() {
    var str = kbn.valueFormats['dthms'](86400, 1);
    expect(str).toBe('24:00:00');
  });
  it('6824413:53:20', function() {
    var str = kbn.valueFormats['dthms'](24567890000, 1);
    expect(str).toBe('6824413:53:20');
  });
});
