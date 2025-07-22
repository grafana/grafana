import { t } from '@grafana/i18n';

import { toHex, sci, toHex0x, toPercent, toPercentUnit } from './arithmeticFormatters';
import {
  dateTimeAsIso,
  dateTimeAsIsoNoDateIfToday,
  dateTimeAsUS,
  dateTimeAsUSNoDateIfToday,
  getDateTimeAsLocalFormat,
  getDateTimeAsLocalFormatNoDateIfToday,
  dateTimeFromNow,
  toClockMilliseconds,
  toClockSeconds,
  toDays,
  toDurationInDaysHoursMinutesSeconds,
  toDurationInHoursMinutesSeconds,
  toDurationInMilliseconds,
  toDurationInSeconds,
  toHours,
  toMicroSeconds,
  toMilliSeconds,
  toMinutes,
  toNanoSeconds,
  toSeconds,
  toTimeTicks,
  dateTimeSystemFormatter,
} from './dateTimeFormatters';
import { binaryPrefix, currency, SIPrefix } from './symbolFormatters';
import {
  locale,
  scaledUnits,
  simpleCountUnit,
  toFixedUnit,
  ValueFormatCategory,
  stringFormater,
  booleanValueFormatter,
} from './valueFormats';

export const getCategories = (): ValueFormatCategory[] => [
  {
    name: t('grafana-data.valueFormats.categories.misc.name', 'Misc'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-number', 'Number'),
        id: 'none',
        fn: toFixedUnit(''),
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-string', 'String'),
        id: 'string',
        fn: stringFormater,
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-short', 'short'),
        id: 'short',
        fn: scaledUnits(1000, ['', ' K', ' Mil', ' Bil', ' Tri', ' Quadr', ' Quint', ' Sext', ' Sept']),
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-si-short', 'SI short'),
        id: 'sishort',
        fn: SIPrefix(''),
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-percent-100', 'Percent (0-100)'),
        id: 'percent',
        fn: toPercent,
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-percent-1', 'Percent (0.0-1.0)'),
        id: 'percentunit',
        fn: toPercentUnit,
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-humidity', 'Humidity (%H)'),
        id: 'humidity',
        fn: toFixedUnit('%H'),
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-decibel', 'Decibel'),
        id: 'dB',
        fn: toFixedUnit('dB'),
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-candala', 'Candela (cd)'),
        id: 'candela',
        fn: SIPrefix('cd'),
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-hexadecimal-0x', 'Hexadecimal (0x)'),
        id: 'hex0x',
        fn: toHex0x,
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-hexadecimal', 'Hexadecimal'),
        id: 'hex',
        fn: toHex,
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-scientific', 'Scientific notation'),
        id: 'sci',
        fn: sci,
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-locale', 'Locale format'),
        id: 'locale',
        fn: locale,
      },
      {
        name: t('grafana-data.valueFormats.categories.misc.formats.name-pixels', 'Pixels'),
        id: 'pixel',
        fn: toFixedUnit('px'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.acceleration.name', 'Acceleration'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.acceleration.formats.name-meters-sec', 'Meters/sec²'),
        id: 'accMS2',
        fn: toFixedUnit('m/sec²'),
      },
      {
        name: t('grafana-data.valueFormats.categories.acceleration.formats.name-feet-sec', 'Feet/sec²'),
        id: 'accFS2',
        fn: toFixedUnit('f/sec²'),
      },
      {
        name: t('grafana-data.valueFormats.categories.acceleration.formats.name-g-unit', 'G unit'),
        id: 'accG',
        fn: toFixedUnit('g'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.angle.name', 'Angle'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.angle.formats.name-degrees', 'Degrees (°)'),
        id: 'degree',
        fn: toFixedUnit('°'),
      },
      {
        name: t('grafana-data.valueFormats.categories.angle.formats.name-radians', 'Radians'),
        id: 'radian',
        fn: toFixedUnit('rad'),
      },
      {
        name: t('grafana-data.valueFormats.categories.angle.formats.name-gradian', 'Gradian'),
        id: 'grad',
        fn: toFixedUnit('grad'),
      },
      {
        name: t('grafana-data.valueFormats.categories.angle.formats.name-arc-minutes', 'Arc Minutes'),
        id: 'arcmin',
        fn: toFixedUnit('arcmin'),
      },
      {
        name: t('grafana-data.valueFormats.categories.angle.formats.name-arc-seconds', 'Arc Seconds'),
        id: 'arcsec',
        fn: toFixedUnit('arcsec'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.area.name', 'Area'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.area.formats.name-square-meters', 'Square Meters (m²)'),
        id: 'areaM2',
        fn: toFixedUnit('m²'),
      },
      {
        name: t('grafana-data.valueFormats.categories.area.formats.name-square-feet', 'Square Feet (ft²)'),
        id: 'areaF2',
        fn: toFixedUnit('ft²'),
      },
      {
        name: t('grafana-data.valueFormats.categories.area.formats.name-square-miles', 'Square Miles (mi²)'),
        id: 'areaMI2',
        fn: toFixedUnit('mi²'),
      },
      {
        name: t('grafana-data.valueFormats.categories.area.formats.name-acres', 'Acres (ac)'),
        id: 'acres',
        fn: toFixedUnit('ac'),
      },
      {
        name: t('grafana-data.valueFormats.categories.area.formats.name-hectares', 'Hectares (ha)'),
        id: 'hectares',
        fn: toFixedUnit('ha'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.computation.name', 'Computation'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-flops', 'FLOP/s'),
        id: 'flops',
        fn: SIPrefix('FLOPS'),
      },
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-mflops', 'MFLOP/s'),
        id: 'mflops',
        fn: SIPrefix('FLOPS', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-gflops', 'GFLOP/s'),
        id: 'gflops',
        fn: SIPrefix('FLOPS', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-tflops', 'TFLOP/s'),
        id: 'tflops',
        fn: SIPrefix('FLOPS', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-pflops', 'PFLOP/s'),
        id: 'pflops',
        fn: SIPrefix('FLOPS', 5),
      },
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-eflops', 'EFLOP/s'),
        id: 'eflops',
        fn: SIPrefix('FLOPS', 6),
      },
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-zflops', 'ZFLOP/s'),
        id: 'zflops',
        fn: SIPrefix('FLOPS', 7),
      },
      {
        name: t('grafana-data.valueFormats.categories.computation.formats.name-yflops', 'YFLOP/s'),
        id: 'yflops',
        fn: SIPrefix('FLOPS', 8),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.concentration.name', 'Concentration'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.concentration.formats.name-ppm', 'parts-per-million (ppm)'),
        id: 'ppm',
        fn: toFixedUnit('ppm'),
      },
      {
        name: t('grafana-data.valueFormats.categories.concentration.formats.name-ppb', 'parts-per-billion (ppb)'),
        id: 'conppb',
        fn: toFixedUnit('ppb'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-ng-m3',
          'nanogram per cubic meter (ng/m³)'
        ),
        id: 'conngm3',
        fn: toFixedUnit('ng/m³'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-ng-nm3',
          'nanogram per normal cubic meter (ng/Nm³)'
        ),
        id: 'conngNm3',
        fn: toFixedUnit('ng/Nm³'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-ug-m3',
          'microgram per cubic meter (μg/m³)'
        ),
        id: 'conμgm3',
        fn: toFixedUnit('μg/m³'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-ug-nm3',
          'microgram per normal cubic meter (μg/Nm³)'
        ),
        id: 'conμgNm3',
        fn: toFixedUnit('μg/Nm³'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-mg-m3',
          'milligram per cubic meter (mg/m³)'
        ),
        id: 'conmgm3',
        fn: toFixedUnit('mg/m³'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-mg-nm3',
          'milligram per normal cubic meter (mg/Nm³)'
        ),
        id: 'conmgNm3',
        fn: toFixedUnit('mg/Nm³'),
      },
      {
        name: t('grafana-data.valueFormats.categories.concentration.formats.name-g-m3', 'gram per cubic meter (g/m³)'),
        id: 'congm3',
        fn: toFixedUnit('g/m³'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-g-nm3',
          'gram per normal cubic meter (g/Nm³)'
        ),
        id: 'congNm3',
        fn: toFixedUnit('g/Nm³'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-mg-dl',
          'milligrams per decilitre (mg/dL)'
        ),
        id: 'conmgdL',
        fn: toFixedUnit('mg/dL'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.concentration.formats.name-mmol-l',
          'millimoles per litre (mmol/L)'
        ),
        id: 'conmmolL',
        fn: toFixedUnit('mmol/L'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.currency.name', 'Currency'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-usd', 'Dollars ($)'),
        id: 'currencyUSD',
        fn: currency('$'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-gbp', 'Pounds (£)'),
        id: 'currencyGBP',
        fn: currency('£'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-eur', 'Euro (€)'),
        id: 'currencyEUR',
        fn: currency('€'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-jpy', 'Yen (¥)'),
        id: 'currencyJPY',
        fn: currency('¥'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-rub', 'Rubles (₽)'),
        id: 'currencyRUB',
        fn: currency('₽'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-uah', 'Hryvnias (₴)'),
        id: 'currencyUAH',
        fn: currency('₴'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-brl', 'Real (R$)'),
        id: 'currencyBRL',
        fn: currency('R$'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-dkk', 'Danish Krone (kr)'),
        id: 'currencyDKK',
        fn: currency('kr', true),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-isk', 'Icelandic Króna (kr)'),
        id: 'currencyISK',
        fn: currency('kr', true),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-nok', 'Norwegian Krone (kr)'),
        id: 'currencyNOK',
        fn: currency('kr', true),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-sek', 'Swedish Krona (kr)'),
        id: 'currencySEK',
        fn: currency('kr', true),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-czk', 'Czech koruna (czk)'),
        id: 'currencyCZK',
        fn: currency('czk'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-chf', 'Swiss franc (CHF)'),
        id: 'currencyCHF',
        fn: currency('CHF'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-pln', 'Polish Złoty (PLN)'),
        id: 'currencyPLN',
        fn: currency('PLN'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-btc', 'Bitcoin (฿)'),
        id: 'currencyBTC',
        fn: currency('฿'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-mbtc', 'Milli Bitcoin (฿)'),
        id: 'currencymBTC',
        fn: currency('mBTC'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-ubtc', 'Micro Bitcoin (฿)'),
        id: 'currencyμBTC',
        fn: currency('μBTC'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-zar', 'South African Rand (R)'),
        id: 'currencyZAR',
        fn: currency('R'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-inr', 'Indian Rupee (₹)'),
        id: 'currencyINR',
        fn: currency('₹'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-krw', 'South Korean Won (₩)'),
        id: 'currencyKRW',
        fn: currency('₩'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-idr', 'Indonesian Rupiah (Rp)'),
        id: 'currencyIDR',
        fn: currency('Rp'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-php', 'Philippine Peso (PHP)'),
        id: 'currencyPHP',
        fn: currency('PHP'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-vnd', 'Vietnamese Dong (VND)'),
        id: 'currencyVND',
        fn: currency('đ', true),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-try', 'Turkish Lira (₺)'),
        id: 'currencyTRY',
        fn: currency('₺', true),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-myr', 'Malaysian Ringgit (RM)'),
        id: 'currencyMYR',
        fn: currency('RM'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-xpf', 'CFP franc (XPF)'),
        id: 'currencyXPF',
        fn: currency('XPF'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-bgn', 'Bulgarian Lev (BGN)'),
        id: 'currencyBGN',
        fn: currency('BGN'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-pyg', 'Guaraní (₲)'),
        id: 'currencyPYG',
        fn: currency('₲'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-uyu', 'Uruguay Peso (UYU)'),
        id: 'currencyUYU',
        fn: currency('UYU'),
      },
      {
        name: t('grafana-data.valueFormats.categories.currency.formats.name-ils', 'Israeli New Shekels (₪)'),
        id: 'currencyILS',
        fn: currency('₪'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.data.name', 'Data'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-bytes-iec', 'bytes(IEC)'),
        id: 'bytes',
        fn: binaryPrefix('B'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-bytes-si', 'bytes(SI)'),
        id: 'decbytes',
        fn: SIPrefix('B'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-bits-iec', 'bits(IEC)'),
        id: 'bits',
        fn: binaryPrefix('b'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-bits-si', 'bits(SI)'),
        id: 'decbits',
        fn: SIPrefix('b'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-kibibytes', 'kibibytes'),
        id: 'kbytes',
        fn: binaryPrefix('B', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-kilobytes', 'kilobytes'),
        id: 'deckbytes',
        fn: SIPrefix('B', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-mebibytes', 'mebibytes'),
        id: 'mbytes',
        fn: binaryPrefix('B', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-megabytes', 'megabytes'),
        id: 'decmbytes',
        fn: SIPrefix('B', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-gibibytes', 'gibibytes'),
        id: 'gbytes',
        fn: binaryPrefix('B', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-gigabytes', 'gigabytes'),
        id: 'decgbytes',
        fn: SIPrefix('B', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-tebibytes', 'tebibytes'),
        id: 'tbytes',
        fn: binaryPrefix('B', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-terabytes', 'terabytes'),
        id: 'dectbytes',
        fn: SIPrefix('B', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-pebibytes', 'pebibytes'),
        id: 'pbytes',
        fn: binaryPrefix('B', 5),
      },
      {
        name: t('grafana-data.valueFormats.categories.data.formats.name-petabytes', 'petabytes'),
        id: 'decpbytes',
        fn: SIPrefix('B', 5),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.data-rate.name', 'Data rate'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-packets-sec', 'packets/sec'),
        id: 'pps',
        fn: SIPrefix('p/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-bytes-sec-iec', 'bytes/sec(IEC)'),
        id: 'binBps',
        fn: binaryPrefix('B/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-bytes-sec-si', 'bytes/sec(SI)'),
        id: 'Bps',
        fn: SIPrefix('B/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-bits-sec-iec', 'bits/sec(IEC)'),
        id: 'binbps',
        fn: binaryPrefix('b/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-bits-sec-si', 'bits/sec(SI)'),
        id: 'bps',
        fn: SIPrefix('b/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-kibibytes-sec', 'kibibytes/sec'),
        id: 'KiBs',
        fn: binaryPrefix('B/s', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-kibibits-sec', 'kibibits/sec'),
        id: 'Kibits',
        fn: binaryPrefix('b/s', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-kilobytes-sec', 'kilobytes/sec'),
        id: 'KBs',
        fn: SIPrefix('B/s', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-kilobits-sec', 'kilobits/sec'),
        id: 'Kbits',
        fn: SIPrefix('b/s', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-mebibytes-sec', 'mebibytes/sec'),
        id: 'MiBs',
        fn: binaryPrefix('B/s', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-mebibits-sec', 'mebibits/sec'),
        id: 'Mibits',
        fn: binaryPrefix('b/s', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-megabytes-sec', 'megabytes/sec'),
        id: 'MBs',
        fn: SIPrefix('B/s', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-megabits-sec', 'megabits/sec'),
        id: 'Mbits',
        fn: SIPrefix('b/s', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-gibibytes-sec', 'gibibytes/sec'),
        id: 'GiBs',
        fn: binaryPrefix('B/s', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-gibibits-sec', 'gibibits/sec'),
        id: 'Gibits',
        fn: binaryPrefix('b/s', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-gigabytes-sec', 'gigabytes/sec'),
        id: 'GBs',
        fn: SIPrefix('B/s', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-gigabits-sec', 'gigabits/sec'),
        id: 'Gbits',
        fn: SIPrefix('b/s', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-tebibytes-sec', 'tebibytes/sec'),
        id: 'TiBs',
        fn: binaryPrefix('B/s', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-tebibits-sec', 'tebibits/sec'),
        id: 'Tibits',
        fn: binaryPrefix('b/s', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-terabytes-sec', 'terabytes/sec'),
        id: 'TBs',
        fn: SIPrefix('B/s', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-terabits-sec', 'terabits/sec'),
        id: 'Tbits',
        fn: SIPrefix('b/s', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-pebibytes-sec', 'pebibytes/sec'),
        id: 'PiBs',
        fn: binaryPrefix('B/s', 5),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-pebibits-sec', 'pebibits/sec'),
        id: 'Pibits',
        fn: binaryPrefix('b/s', 5),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-petabytes-sec', 'petabytes/sec'),
        id: 'PBs',
        fn: SIPrefix('B/s', 5),
      },
      {
        name: t('grafana-data.valueFormats.categories.data-rate.formats.name-petabits-sec', 'petabits/sec'),
        id: 'Pbits',
        fn: SIPrefix('b/s', 5),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.date-time.name', 'Date & time'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.date-time.formats.name-datetime-iso', 'Datetime ISO'),
        id: 'dateTimeAsIso',
        fn: dateTimeAsIso,
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.date-time.formats.name-datetime-iso-no-date',
          'Datetime ISO (No date if today)'
        ),
        id: 'dateTimeAsIsoNoDateIfToday',
        fn: dateTimeAsIsoNoDateIfToday,
      },
      {
        name: t('grafana-data.valueFormats.categories.date-time.formats.name-datetime-us', 'Datetime US'),
        id: 'dateTimeAsUS',
        fn: dateTimeAsUS,
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.date-time.formats.name-datetime-us-no-date',
          'Datetime US (No date if today)'
        ),
        id: 'dateTimeAsUSNoDateIfToday',
        fn: dateTimeAsUSNoDateIfToday,
      },
      {
        name: t('grafana-data.valueFormats.categories.date-time.formats.name-datetime-local', 'Datetime local'),
        id: 'dateTimeAsLocal',
        fn: getDateTimeAsLocalFormat(),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.date-time.formats.name-datetime-local-no-date',
          'Datetime local (No date if today)'
        ),
        id: 'dateTimeAsLocalNoDateIfToday',
        fn: getDateTimeAsLocalFormatNoDateIfToday(),
      },
      {
        name: t('grafana-data.valueFormats.categories.date-time.formats.name-datetime-default', 'Datetime default'),
        id: 'dateTimeAsSystem',
        fn: dateTimeSystemFormatter,
      },
      {
        name: t('grafana-data.valueFormats.categories.date-time.formats.name-from-now', 'From Now'),
        id: 'dateTimeFromNow',
        fn: dateTimeFromNow,
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.energy.name', 'Energy'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-watt', 'Watt (W)'),
        id: 'watt',
        fn: SIPrefix('W'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kilowatt', 'Kilowatt (kW)'),
        id: 'kwatt',
        fn: SIPrefix('W', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-megawatt', 'Megawatt (MW)'),
        id: 'megwatt',
        fn: SIPrefix('W', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-gigawatt', 'Gigawatt (GW)'),
        id: 'gwatt',
        fn: SIPrefix('W', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-milliwatt', 'Milliwatt (mW)'),
        id: 'mwatt',
        fn: SIPrefix('W', -1),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.energy.formats.name-watt-square-meter',
          'Watt per square meter (W/m²)'
        ),
        id: 'Wm2',
        fn: SIPrefix('W/m²'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-volt-ampere', 'Volt-Ampere (VA)'),
        id: 'voltamp',
        fn: SIPrefix('VA'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kilovolt-ampere', 'Kilovolt-Ampere (kVA)'),
        id: 'kvoltamp',
        fn: SIPrefix('VA', 1),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.energy.formats.name-volt-ampere-reactive',
          'Volt-Ampere reactive (VAr)'
        ),
        id: 'voltampreact',
        fn: SIPrefix('VAr'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.energy.formats.name-kilovolt-ampere-reactive',
          'Kilovolt-Ampere reactive (kVAr)'
        ),
        id: 'kvoltampreact',
        fn: SIPrefix('VAr', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-watt-hour', 'Watt-hour (Wh)'),
        id: 'watth',
        fn: SIPrefix('Wh'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.energy.formats.name-watt-hour-per-kg',
          'Watt-hour per Kilogram (Wh/kg)'
        ),
        id: 'watthperkg',
        fn: SIPrefix('Wh/kg'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kilowatt-hour', 'Kilowatt-hour (kWh)'),
        id: 'kwatth',
        fn: SIPrefix('Wh', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kilowatt-min', 'Kilowatt-min (kWm)'),
        id: 'kwattm',
        fn: SIPrefix('W-Min', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-megawatt-hour', 'Megawatt-hour (MWh)'),
        id: 'mwatth',
        fn: SIPrefix('Wh', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-ampere-hour', 'Ampere-hour (Ah)'),
        id: 'amph',
        fn: SIPrefix('Ah'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kiloampere-hour', 'Kiloampere-hour (kAh)'),
        id: 'kamph',
        fn: SIPrefix('Ah', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-milliampere-hour', 'Milliampere-hour (mAh)'),
        id: 'mamph',
        fn: SIPrefix('Ah', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-joule', 'Joule (J)'),
        id: 'joule',
        fn: SIPrefix('J'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-electron-volt', 'Electron volt (eV)'),
        id: 'ev',
        fn: SIPrefix('eV'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-ampere', 'Ampere (A)'),
        id: 'amp',
        fn: SIPrefix('A'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kiloampere', 'Kiloampere (kA)'),
        id: 'kamp',
        fn: SIPrefix('A', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-milliampere', 'Milliampere (mA)'),
        id: 'mamp',
        fn: SIPrefix('A', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-volt', 'Volt (V)'),
        id: 'volt',
        fn: SIPrefix('V'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kilovolt', 'Kilovolt (kV)'),
        id: 'kvolt',
        fn: SIPrefix('V', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-millivolt', 'Millivolt (mV)'),
        id: 'mvolt',
        fn: SIPrefix('V', -1),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.energy.formats.name-decibel-milliwatt',
          'Decibel-milliwatt (dBm)'
        ),
        id: 'dBm',
        fn: SIPrefix('dBm'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-milliohm', 'Milliohm (mΩ)'),
        id: 'mohm',
        fn: SIPrefix('Ω', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-ohm', 'Ohm (Ω)'),
        id: 'ohm',
        fn: SIPrefix('Ω'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-kiloohm', 'Kiloohm (kΩ)'),
        id: 'kohm',
        fn: SIPrefix('Ω', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-megaohm', 'Megaohm (MΩ)'),
        id: 'Mohm',
        fn: SIPrefix('Ω', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-farad', 'Farad (F)'),
        id: 'farad',
        fn: SIPrefix('F'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-microfarad', 'Microfarad (µF)'),
        id: 'µfarad',
        fn: SIPrefix('F', -2),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-nanofarad', 'Nanofarad (nF)'),
        id: 'nfarad',
        fn: SIPrefix('F', -3),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-picofarad', 'Picofarad (pF)'),
        id: 'pfarad',
        fn: SIPrefix('F', -4),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-femtofarad', 'Femtofarad (fF)'),
        id: 'ffarad',
        fn: SIPrefix('F', -5),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-henry', 'Henry (H)'),
        id: 'henry',
        fn: SIPrefix('H'),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-millihenry', 'Millihenry (mH)'),
        id: 'mhenry',
        fn: SIPrefix('H', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-microhenry', 'Microhenry (µH)'),
        id: 'µhenry',
        fn: SIPrefix('H', -2),
      },
      {
        name: t('grafana-data.valueFormats.categories.energy.formats.name-lumens', 'Lumens (Lm)'),
        id: 'lumens',
        fn: SIPrefix('Lm'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.flow.name', 'Flow'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-gallons-min', 'Gallons/min (gpm)'),
        id: 'flowgpm',
        fn: toFixedUnit('gpm'),
      },
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-cubic-meters-sec', 'Cubic meters/sec (cms)'),
        id: 'flowcms',
        fn: toFixedUnit('cms'),
      },
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-cubic-feet-sec', 'Cubic feet/sec (cfs)'),
        id: 'flowcfs',
        fn: toFixedUnit('cfs'),
      },
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-cubic-feet-min', 'Cubic feet/min (cfm)'),
        id: 'flowcfm',
        fn: toFixedUnit('cfm'),
      },
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-litre-hour', 'Litre/hour'),
        id: 'litreh',
        fn: toFixedUnit('L/h'),
      },
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-litre-min', 'Litre/min (L/min)'),
        id: 'flowlpm',
        fn: toFixedUnit('L/min'),
      },
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-millilitre-min', 'milliLitre/min (mL/min)'),
        id: 'flowmlpm',
        fn: toFixedUnit('mL/min'),
      },
      {
        name: t('grafana-data.valueFormats.categories.flow.formats.name-lux', 'Lux (lx)'),
        id: 'lux',
        fn: toFixedUnit('lux'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.force.name', 'Force'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.force.formats.name-newton-meters', 'Newton-meters (Nm)'),
        id: 'forceNm',
        fn: SIPrefix('Nm'),
      },
      {
        name: t('grafana-data.valueFormats.categories.force.formats.name-kilonewton-meters', 'Kilonewton-meters (kNm)'),
        id: 'forcekNm',
        fn: SIPrefix('Nm', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.force.formats.name-newtons', 'Newtons (N)'),
        id: 'forceN',
        fn: SIPrefix('N'),
      },
      {
        name: t('grafana-data.valueFormats.categories.force.formats.name-kilonewtons', 'Kilonewtons (kN)'),
        id: 'forcekN',
        fn: SIPrefix('N', 1),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.hash-rate.name', 'Hash rate'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.hash-rate.formats.name-hashes-sec', 'hashes/sec'),
        id: 'Hs',
        fn: SIPrefix('H/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.hash-rate.formats.name-kilohashes-sec', 'kilohashes/sec'),
        id: 'KHs',
        fn: SIPrefix('H/s', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.hash-rate.formats.name-megahashes-sec', 'megahashes/sec'),
        id: 'MHs',
        fn: SIPrefix('H/s', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.hash-rate.formats.name-gigahashes-sec', 'gigahashes/sec'),
        id: 'GHs',
        fn: SIPrefix('H/s', 3),
      },
      {
        name: t('grafana-data.valueFormats.categories.hash-rate.formats.name-terahashes-sec', 'terahashes/sec'),
        id: 'THs',
        fn: SIPrefix('H/s', 4),
      },
      {
        name: t('grafana-data.valueFormats.categories.hash-rate.formats.name-petahashes-sec', 'petahashes/sec'),
        id: 'PHs',
        fn: SIPrefix('H/s', 5),
      },
      {
        name: t('grafana-data.valueFormats.categories.hash-rate.formats.name-exahashes-sec', 'exahashes/sec'),
        id: 'EHs',
        fn: SIPrefix('H/s', 6),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.mass.name', 'Mass'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.mass.formats.name-milligram', 'milligram (mg)'),
        id: 'massmg',
        fn: SIPrefix('g', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.mass.formats.name-gram', 'gram (g)'),
        id: 'massg',
        fn: SIPrefix('g'),
      },
      {
        name: t('grafana-data.valueFormats.categories.mass.formats.name-pound', 'pound (lb)'),
        id: 'masslb',
        fn: toFixedUnit('lb'),
      },
      {
        name: t('grafana-data.valueFormats.categories.mass.formats.name-kilogram', 'kilogram (kg)'),
        id: 'masskg',
        fn: SIPrefix('g', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.mass.formats.name-metric-ton', 'metric ton (t)'),
        id: 'masst',
        fn: toFixedUnit('t'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.length.name', 'Length'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.length.formats.name-millimeter', 'millimeter (mm)'),
        id: 'lengthmm',
        fn: SIPrefix('m', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.length.formats.name-inch', 'inch (in)'),
        id: 'lengthin',
        fn: toFixedUnit('in'),
      },
      {
        name: t('grafana-data.valueFormats.categories.length.formats.name-feet', 'feet (ft)'),
        id: 'lengthft',
        fn: toFixedUnit('ft'),
      },
      {
        name: t('grafana-data.valueFormats.categories.length.formats.name-meter', 'meter (m)'),
        id: 'lengthm',
        fn: SIPrefix('m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.length.formats.name-kilometer', 'kilometer (km)'),
        id: 'lengthkm',
        fn: SIPrefix('m', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.length.formats.name-mile', 'mile (mi)'),
        id: 'lengthmi',
        fn: toFixedUnit('mi'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.pressure.name', 'Pressure'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-millibars', 'Millibars'),
        id: 'pressurembar',
        fn: SIPrefix('bar', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-bars', 'Bars'),
        id: 'pressurebar',
        fn: SIPrefix('bar'),
      },
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-kilobars', 'Kilobars'),
        id: 'pressurekbar',
        fn: SIPrefix('bar', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-pascals', 'Pascals'),
        id: 'pressurepa',
        fn: SIPrefix('Pa'),
      },
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-hectopascals', 'Hectopascals'),
        id: 'pressurehpa',
        fn: toFixedUnit('hPa'),
      },
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-kilopascals', 'Kilopascals'),
        id: 'pressurekpa',
        fn: toFixedUnit('kPa'),
      },
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-inches-mercury', 'Inches of mercury'),
        id: 'pressurehg',
        fn: toFixedUnit('"Hg'),
      },
      {
        name: t('grafana-data.valueFormats.categories.pressure.formats.name-psi', 'PSI'),
        id: 'pressurepsi',
        fn: scaledUnits(1000, ['psi', 'ksi', 'Mpsi']),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.radiation.name', 'Radiation'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-becquerel', 'Becquerel (Bq)'),
        id: 'radbq',
        fn: SIPrefix('Bq'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-curie', 'curie (Ci)'),
        id: 'radci',
        fn: SIPrefix('Ci'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-gray', 'Gray (Gy)'),
        id: 'radgy',
        fn: SIPrefix('Gy'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-rad', 'rad'),
        id: 'radrad',
        fn: SIPrefix('rad'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-sievert', 'Sievert (Sv)'),
        id: 'radsv',
        fn: SIPrefix('Sv'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-millisievert', 'milliSievert (mSv)'),
        id: 'radmsv',
        fn: SIPrefix('Sv', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-microsievert', 'microSievert (µSv)'),
        id: 'radusv',
        fn: SIPrefix('Sv', -2),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-rem', 'rem'),
        id: 'radrem',
        fn: SIPrefix('rem'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-exposure', 'Exposure (C/kg)'),
        id: 'radexpckg',
        fn: SIPrefix('C/kg'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-roentgen', 'roentgen (R)'),
        id: 'radr',
        fn: SIPrefix('R'),
      },
      {
        name: t('grafana-data.valueFormats.categories.radiation.formats.name-sievert-hour', 'Sievert/hour (Sv/h)'),
        id: 'radsvh',
        fn: SIPrefix('Sv/h'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.radiation.formats.name-millisievert-hour',
          'milliSievert/hour (mSv/h)'
        ),
        id: 'radmsvh',
        fn: SIPrefix('Sv/h', -1),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.radiation.formats.name-microsievert-hour',
          'microSievert/hour (µSv/h)'
        ),
        id: 'radusvh',
        fn: SIPrefix('Sv/h', -2),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.rotational-speed.name', 'Rotational Speed'),
    formats: [
      {
        name: t(
          'grafana-data.valueFormats.categories.rotational-speed.formats.name-rpm',
          'Revolutions per minute (rpm)'
        ),
        id: 'rotrpm',
        fn: toFixedUnit('rpm'),
      },
      {
        name: t('grafana-data.valueFormats.categories.rotational-speed.formats.name-hertz', 'Hertz (Hz)'),
        id: 'rothz',
        fn: SIPrefix('Hz'),
      },
      {
        name: t('grafana-data.valueFormats.categories.rotational-speed.formats.name-kilohertz', 'Kilohertz (kHz)'),
        id: 'rotkhz',
        fn: SIPrefix('Hz', 1),
      },
      {
        name: t('grafana-data.valueFormats.categories.rotational-speed.formats.name-megahertz', 'Megahertz (MHz)'),
        id: 'rotmhz',
        fn: SIPrefix('Hz', 2),
      },
      {
        name: t('grafana-data.valueFormats.categories.rotational-speed.formats.name-gigahertz', 'Gigahertz (GHz)'),
        id: 'rotghz',
        fn: SIPrefix('Hz', 3),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.rotational-speed.formats.name-radians-sec',
          'Radians per second (rad/s)'
        ),
        id: 'rotrads',
        fn: toFixedUnit('rad/s'),
      },
      {
        name: t(
          'grafana-data.valueFormats.categories.rotational-speed.formats.name-degrees-sec',
          'Degrees per second (°/s)'
        ),
        id: 'rotdegs',
        fn: toFixedUnit('°/s'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.temperature.name', 'Temperature'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.temperature.formats.name-celsius', 'Celsius (°C)'),
        id: 'celsius',
        fn: toFixedUnit('°C'),
      },
      {
        name: t('grafana-data.valueFormats.categories.temperature.formats.name-fahrenheit', 'Fahrenheit (°F)'),
        id: 'fahrenheit',
        fn: toFixedUnit('°F'),
      },
      {
        name: t('grafana-data.valueFormats.categories.temperature.formats.name-kelvin', 'Kelvin (K)'),
        id: 'kelvin',
        fn: toFixedUnit('K'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.time.name', 'Time'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-hertz', 'Hertz (1/s)'),
        id: 'hertz',
        fn: SIPrefix('Hz'),
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-nanoseconds', 'nanoseconds (ns)'),
        id: 'ns',
        fn: toNanoSeconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-microseconds', 'microseconds (µs)'),
        id: 'µs',
        fn: toMicroSeconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-milliseconds', 'milliseconds (ms)'),
        id: 'ms',
        fn: toMilliSeconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-seconds', 'seconds (s)'),
        id: 's',
        fn: toSeconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-minutes', 'minutes (m)'),
        id: 'm',
        fn: toMinutes,
      },
      { name: t('grafana-data.valueFormats.categories.time.formats.name-hours', 'hours (h)'), id: 'h', fn: toHours },
      { name: t('grafana-data.valueFormats.categories.time.formats.name-days', 'days (d)'), id: 'd', fn: toDays },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-duration-ms', 'duration (ms)'),
        id: 'dtdurationms',
        fn: toDurationInMilliseconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-duration-s', 'duration (s)'),
        id: 'dtdurations',
        fn: toDurationInSeconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-duration-hms', 'duration (hh:mm:ss)'),
        id: 'dthms',
        fn: toDurationInHoursMinutesSeconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-duration-dhms', 'duration (d hh:mm:ss)'),
        id: 'dtdhms',
        fn: toDurationInDaysHoursMinutesSeconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-timeticks', 'Timeticks (s/100)'),
        id: 'timeticks',
        fn: toTimeTicks,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-clock-ms', 'clock (ms)'),
        id: 'clockms',
        fn: toClockMilliseconds,
      },
      {
        name: t('grafana-data.valueFormats.categories.time.formats.name-clock-s', 'clock (s)'),
        id: 'clocks',
        fn: toClockSeconds,
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.throughput.name', 'Throughput'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-counts-sec', 'counts/sec (cps)'),
        id: 'cps',
        fn: simpleCountUnit('c/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-ops-sec', 'ops/sec (ops)'),
        id: 'ops',
        fn: simpleCountUnit('ops/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-requests-sec', 'requests/sec (rps)'),
        id: 'reqps',
        fn: simpleCountUnit('req/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-reads-sec', 'reads/sec (rps)'),
        id: 'rps',
        fn: simpleCountUnit('rd/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-writes-sec', 'writes/sec (wps)'),
        id: 'wps',
        fn: simpleCountUnit('wr/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-io-ops-sec', 'I/O ops/sec (iops)'),
        id: 'iops',
        fn: simpleCountUnit('io/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-events-sec', 'events/sec (eps)'),
        id: 'eps',
        fn: simpleCountUnit('evt/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-messages-sec', 'messages/sec (mps)'),
        id: 'mps',
        fn: simpleCountUnit('msg/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-records-sec', 'records/sec (rps)'),
        id: 'recps',
        fn: simpleCountUnit('rec/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-rows-sec', 'rows/sec (rps)'),
        id: 'rowsps',
        fn: simpleCountUnit('rows/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-counts-min', 'counts/min (cpm)'),
        id: 'cpm',
        fn: simpleCountUnit('c/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-ops-min', 'ops/min (opm)'),
        id: 'opm',
        fn: simpleCountUnit('ops/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-requests-min', 'requests/min (rpm)'),
        id: 'reqpm',
        fn: simpleCountUnit('req/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-reads-min', 'reads/min (rpm)'),
        id: 'rpm',
        fn: simpleCountUnit('rd/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-writes-min', 'writes/min (wpm)'),
        id: 'wpm',
        fn: simpleCountUnit('wr/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-events-min', 'events/min (epm)'),
        id: 'epm',
        fn: simpleCountUnit('evts/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-messages-min', 'messages/min (mpm)'),
        id: 'mpm',
        fn: simpleCountUnit('msgs/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-records-min', 'records/min (rpm)'),
        id: 'recpm',
        fn: simpleCountUnit('rec/m'),
      },
      {
        name: t('grafana-data.valueFormats.categories.throughput.formats.name-rows-min', 'rows/min (rpm)'),
        id: 'rowspm',
        fn: simpleCountUnit('rows/m'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.velocity.name', 'Velocity'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.velocity.formats.name-meters-second', 'meters/second (m/s)'),
        id: 'velocityms',
        fn: toFixedUnit('m/s'),
      },
      {
        name: t('grafana-data.valueFormats.categories.velocity.formats.name-kilometers-hour', 'kilometers/hour (km/h)'),
        id: 'velocitykmh',
        fn: toFixedUnit('km/h'),
      },
      {
        name: t('grafana-data.valueFormats.categories.velocity.formats.name-miles-hour', 'miles/hour (mph)'),
        id: 'velocitymph',
        fn: toFixedUnit('mph'),
      },
      {
        name: t('grafana-data.valueFormats.categories.velocity.formats.name-knot', 'knot (kn)'),
        id: 'velocityknot',
        fn: toFixedUnit('kn'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.volume.name', 'Volume'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.volume.formats.name-millilitre', 'millilitre (mL)'),
        id: 'mlitre',
        fn: SIPrefix('L', -1),
      },
      {
        name: t('grafana-data.valueFormats.categories.volume.formats.name-litre', 'litre (L)'),
        id: 'litre',
        fn: SIPrefix('L'),
      },
      {
        name: t('grafana-data.valueFormats.categories.volume.formats.name-cubic-meter', 'cubic meter'),
        id: 'm3',
        fn: toFixedUnit('m³'),
      },
      {
        name: t('grafana-data.valueFormats.categories.volume.formats.name-normal-cubic-meter', 'Normal cubic meter'),
        id: 'Nm3',
        fn: toFixedUnit('Nm³'),
      },
      {
        name: t('grafana-data.valueFormats.categories.volume.formats.name-cubic-decimeter', 'cubic decimeter'),
        id: 'dm3',
        fn: toFixedUnit('dm³'),
      },
      {
        name: t('grafana-data.valueFormats.categories.volume.formats.name-gallons', 'gallons'),
        id: 'gallons',
        fn: toFixedUnit('gal'),
      },
    ],
  },
  {
    name: t('grafana-data.valueFormats.categories.boolean.name', 'Boolean'),
    formats: [
      {
        name: t('grafana-data.valueFormats.categories.boolean.formats.name-true-false', 'True / False'),
        id: 'bool',
        fn: booleanValueFormatter('True', 'False'),
      },
      {
        name: t('grafana-data.valueFormats.categories.boolean.formats.name-yes-no', 'Yes / No'),
        id: 'bool_yes_no',
        fn: booleanValueFormatter('Yes', 'No'),
      },
      {
        name: t('grafana-data.valueFormats.categories.boolean.formats.name-on-off', 'On / Off'),
        id: 'bool_on_off',
        fn: booleanValueFormatter('On', 'Off'),
      },
    ],
  },
];
