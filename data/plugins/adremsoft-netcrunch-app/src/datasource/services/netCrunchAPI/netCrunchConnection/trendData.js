/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

/* eslint-disable no-param-reassign */

import moment from 'moment';

const NETCRUNCH_TREND_DATA_CONST = {

  MAX_SAMPLE_COUNT: {
    MIN: 10,
    DEFAULT: 200,
    MAX: 5000
  },

  PERIOD_TYPE: {
    tpMinutes: 0,
    tpHours: 1,
    tpDays: 2,
    tpMonths: 3
  },

  QUERY_RESULT_MASKS: {
    min: 'tqrMin',
    avg: 'tqrAvg',
    max: 'tqrMax',
    avail: 'tqrAvail',
    delta: 'tqrDelta',
    equal: 'tqrEqual',
    distr: 'tqrDistr'
  },

  QUERY_RESULT_ORDER: ['avg', 'min', 'max', 'avail', 'delta', 'equal']
};

function NetCrunchTrendData(netCrunchConnection) {
  const
    PERIOD_TYPE = NETCRUNCH_TREND_DATA_CONST.PERIOD_TYPE,
    PERIOD_NAMES = {
      [PERIOD_TYPE.tpMinutes]: 'minutes',
      [PERIOD_TYPE.tpHours]: 'hours',
      [PERIOD_TYPE.tpDays]: 'days',
      [PERIOD_TYPE.tpMonths]: 'months'
    },
    QUERY_RESULT_MASKS = NETCRUNCH_TREND_DATA_CONST.QUERY_RESULT_MASKS,
    QUERY_RESULT_ORDER = NETCRUNCH_TREND_DATA_CONST.QUERY_RESULT_ORDER,
    MAX_SAMPLE_COUNT = NETCRUNCH_TREND_DATA_CONST.MAX_SAMPLE_COUNT,
    RAW_DATA_MAX_RANGE = {
      periodInterval: 2,
      periodName: PERIOD_NAMES[PERIOD_TYPE.tpDays]
    };

  function convertPeriodTypeToName(periodType) {
    return PERIOD_NAMES[periodType];
  }

  function calculateMaxDataPoints(maxDataPoints = null) {
    let result = MAX_SAMPLE_COUNT.DEFAULT;

    if (maxDataPoints != null) {
      const maxDataPointsInt = parseInt(maxDataPoints, 10);
      if ((!isNaN(maxDataPoints)) &&
          (maxDataPoints >= MAX_SAMPLE_COUNT.MIN) && (maxDataPoints <= MAX_SAMPLE_COUNT.MAX)) {
        result = maxDataPointsInt;
      }
    }

    return result;
  }

  function floorTime(time, period) {                // period: minutes, hours, days, months
    const MINUTES_SLOT = 5;
    let
      minuteRemains,
      result;

    period = period.toUpperCase();
    if (period === 'MINUTES') {
      minuteRemains = time.minute() % MINUTES_SLOT;
      result = time.subtract(minuteRemains, 'minutes');
    } else {
      if (period === 'HOURS') {
        period = 'hour';
      } else if (period === 'DAYS') {
        period = 'day';
      } else if (period === 'MONTHS') {
        period = 'month';
      }
      result = time.startOf(period);
    }
    return result.startOf('minute');
  }

  function addMarginsToTimeRange(rangeFrom, rangeTo, period) {

    rangeFrom = moment(rangeFrom).subtract(period.periodInterval, period.periodName);
    rangeTo = moment(rangeTo).add(period.periodInterval, period.periodName);

    if (rangeTo > moment()) {
      rangeTo = moment();
    }

    return {
      from: floorTime(rangeFrom, period.periodName),
      to: rangeTo,
      periodInterval: period.periodInterval,
      periodType: period.periodType,
      periodName: period.periodName
    };
  }

  function calculateRAWTimeRange(rangeFrom, rangeTo) {
    const period = {
      periodType: PERIOD_TYPE.tpMinutes,
      periodName: convertPeriodTypeToName(PERIOD_TYPE.tpMinutes),
      periodInterval: 1
    };
    return addMarginsToTimeRange(rangeFrom, rangeTo, period);
  }

  function calculateChartDataInterval(dateStart, dateEnd, maxSampleCount) {
    const
      min = 60 * 1000,
      hour = 60 * min,
      day = 24 * hour,
      month = 30 * day,
      dateRange = Number(dateEnd - dateStart),

      periods = [
        { length: min, type: PERIOD_TYPE.tpMinutes, interval: 1 },
        { length: 5 * min, type: PERIOD_TYPE.tpMinutes, interval: 5 },
        { length: 10 * min, type: PERIOD_TYPE.tpMinutes, interval: 10 },
        { length: 15 * min, type: PERIOD_TYPE.tpMinutes, interval: 15 },
        { length: 20 * min, type: PERIOD_TYPE.tpMinutes, interval: 20 },
        { length: 30 * min, type: PERIOD_TYPE.tpMinutes, interval: 30 },
        { length: hour, type: PERIOD_TYPE.tpHours, interval: 1 },
        { length: 2 * hour, type: PERIOD_TYPE.tpHours, interval: 2 },
        { length: 3 * hour, type: PERIOD_TYPE.tpHours, interval: 3 },
        { length: 4 * hour, type: PERIOD_TYPE.tpHours, interval: 4 },
        { length: 6 * hour, type: PERIOD_TYPE.tpHours, interval: 6 },
        { length: 8 * hour, type: PERIOD_TYPE.tpHours, interval: 8 },
        { length: day, type: PERIOD_TYPE.tpDays, interval: 1 },
        { length: 7 * day, type: PERIOD_TYPE.tpDays, interval: 7 },
        { length: month, type: PERIOD_TYPE.tpMonths, interval: 1 },
        { length: 3 * month, type: PERIOD_TYPE.tpMonths, interval: 3 },
        { length: 6 * month, type: PERIOD_TYPE.tpMonths, interval: 6 },
        { length: 9 * month, type: PERIOD_TYPE.tpMonths, interval: 9 },
        { length: 12 * month, type: PERIOD_TYPE.tpMonths, interval: 12 },
        { length: 15 * month, type: PERIOD_TYPE.tpMonths, interval: 15 },
        { length: 18 * month, type: PERIOD_TYPE.tpMonths, interval: 18 },
        { length: 21 * month, type: PERIOD_TYPE.tpMonths, interval: 21 },
        { length: 24 * month, type: PERIOD_TYPE.tpMonths, interval: 24 }
      ];

    let periodIndex = 0;

    periods.some((period, index) => {
      if ((period.length * maxSampleCount) > dateRange) {
        periodIndex = index;
        return true;
      }
      return false;
    });

    return {
      periodType: periods[periodIndex].type,
      periodName: convertPeriodTypeToName(periods[periodIndex].type),
      periodInterval: periods[periodIndex].interval
    };
  }

  function calculateTimeRange(rangeFrom, rangeTo, maxDataPoints) {
    const period = calculateChartDataInterval(rangeFrom, rangeTo, maxDataPoints);
    return addMarginsToTimeRange(rangeFrom, rangeTo, period);
  }

  function prepareResultMask(series) {
    let resultMask;

    resultMask = Object.keys(series).filter(seriesKey =>
      ((series[seriesKey] === true) && (QUERY_RESULT_MASKS[seriesKey] != null)));

    resultMask = resultMask.map(seriesKey => QUERY_RESULT_MASKS[seriesKey]);

    return { ResultMask: resultMask };
  }

  function calculateTimeDomain(dateFrom, periodType, periodInterval, intervalCount) {
    const
      timeDomain = [],
      periodName = convertPeriodTypeToName(periodType);
    let
      timeDomainItem,
      i;

    dateFrom = moment(dateFrom).startOf('minute');
    for (i = 0; i < intervalCount; i += 1) {
      timeDomainItem = moment(dateFrom).add(i * periodInterval, periodName);
      timeDomain.push(timeDomainItem.toDate());
    }
    return timeDomain;
  }

  function convertResultData(result, resultType) {
    const convertedData = Object.create(null);
    let resultSeries;

    resultType = resultType.ResultMask[0];
    // eslint-disable-next-line
    resultSeries = QUERY_RESULT_ORDER.filter(seriesType => (resultType.indexOf(QUERY_RESULT_MASKS[seriesType]) >= 0));
    resultSeries.forEach((seriesName) => {
      convertedData[seriesName] = [];
    });

    result.trend.forEach((data) => {
      if (Array.isArray(data) === true) {
        data.forEach((value, $index) => {
          convertedData[resultSeries[$index]].push(value);
        });
      } else {
        convertedData[resultSeries[0]].push(data);
      }
    });

    if (result.distr != null) {
      convertedData.distr = result.distr;
    }

    return convertedData;
  }

  function prepareTimeRange(rangeFrom, rangeTo, rawData, maxDataPoints = null) {
    let range = null;

    maxDataPoints = calculateMaxDataPoints(maxDataPoints);
    if (rawData === true) {
      if (moment(rangeTo).subtract(RAW_DATA_MAX_RANGE.periodInterval, RAW_DATA_MAX_RANGE.periodName) <= rangeFrom) {
        range = {
          result: calculateRAWTimeRange(rangeFrom, rangeTo)
        };
      } else {
        range = {
          error: {
            periodInterval: RAW_DATA_MAX_RANGE.periodInterval,
            periodName: RAW_DATA_MAX_RANGE.periodName
          }
        };
      }
    } else {
      range = {
        result: calculateTimeRange(rangeFrom, rangeTo, maxDataPoints)
      };
    }

    return range;
  }

  function getCounterTrendData(nodeID, counter, dateFrom, dateTo, periodType = PERIOD_TYPE.tpHours,
                               periodInterval = 1, resultType) {      // eslint-disable-line

    // resultType possible values are:
    //    [ tqrAvg, tqrMin, tqrMax, tqrAvail, tqrDelta, tqrEqual, tqrDistr ]
    // Default tqrAvg is used : {ResultMask : ['tqrAvg']}

    if ((nodeID == null) || (counter == null)) {
      return Promise.resolve(null);
    }

    resultType = (resultType == null) ? prepareResultMask({ avg: true }) : prepareResultMask(resultType);
    if (resultType.ResultMask[0].length === 0) {
      resultType = prepareResultMask({ avg: true });
    }

    return netCrunchConnection.queryTrendData(nodeID.toString(), counter, periodType, periodInterval,
                                              dateFrom, dateTo,
                                              resultType,
                                              null, // day mask just no mask
                                              null, // value for equal checking
                                              null)
      .then((data) => {       // eslint-disable-line
        return {
          domain: calculateTimeDomain(dateFrom, periodType, periodInterval, data.trend.length),
          values: convertResultData(data, resultType)
        };
      });
  }

  function getCounterTrendRAWData(nodeID, counter, dateFrom, dateTo, resultType) {
    return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpMinutes, 1, resultType);
  }

  function getCounterData(nodeID, counterName, dateStart, dateEnd, maxSampleCount, resultType, period) {
    const result = Object.create(null);

    dateEnd = dateEnd || moment();
    maxSampleCount = maxSampleCount || MAX_SAMPLE_COUNT.DEFAULT;
    period = period || calculateChartDataInterval(dateStart, dateEnd, maxSampleCount);

    result.period = period;
    result.data = getCounterTrendData(nodeID, counterName, dateStart, dateEnd, period.periodType,
                                      period.periodInterval, resultType);
    return result;
  }

  function grafanaDataConverter(data) {
    return data.domain.map((time, $index) => [data.values[$index], time.getTime()]);
  }

  return {
    MAX_SAMPLE_COUNT,
    prepareTimeRange,
    getCounterTrendData,
    getCounterTrendRAWData,
    getCounterData,
    grafanaDataConverter
  };
}

export {
  NETCRUNCH_TREND_DATA_CONST,
  NetCrunchTrendData
};
