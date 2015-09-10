/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-06-18
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
    'angular',
    'lodash',
    'moment'
  ],

  function (angular, _, moment) {

    'use strict';

    var module = angular.module('grafana.services');

    /* global angular, console */

    module
      .factory('chartDataProvider', function ($http, $q, netCrunchRemoteSession,
                                              netCrunchChartDataProviderConsts) {

        var PERIOD_TYPE = {
              tpMinutes : 0,
              tpHours : 1,
              tpDays : 2,
              tpMonths : 3
            },

            QUERY_RESULT_MASKS = {
              min : 'tqrMin',
              avg : 'tqrAvg',
              max : 'tqrMax',
              avail : 'tqrAvail',
              delta : 'tqrDelta',
              equal : 'tqrEqual',
              distr : 'tqrDistr'
            };

        function calculateChartDataInterval ( dateStart, dateEnd, maxSampleCount ) {
          var min = 60 * 1000,
              hour = 60 * min,
              day = 24 * hour,
              month = 30 * day,
              dateRange = Number(dateEnd - dateStart),
              periodIndex,

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

          periodIndex=0;

          periods.some(function ( period, index ) {
           if ((period.length * maxSampleCount) > dateRange) {
             periodIndex=index;
             return true;
           } else {
             return false;
           }
          });

          return {
           periodType: periods[periodIndex].type,
           periodInterval: periods[periodIndex].interval
          };
        }

        function calculateTimeDomain (dateFrom, periodType, periodInterval, intervalCount) {
          var timeDomain = [],
              timeCalculator = Object.create(null),
              timeDomainElement,
              I;

          timeCalculator[PERIOD_TYPE.tpMinutes] = 'minutes';
          timeCalculator[PERIOD_TYPE.tpHours] = 'hours';
          timeCalculator[PERIOD_TYPE.tpDays] = 'days';
          timeCalculator[PERIOD_TYPE.tpMonths] = 'months';

          dateFrom = moment(dateFrom).startOf('minute');
          for (I=0; I < intervalCount; I += 1) {
            timeDomainElement = moment(dateFrom).add(I * periodInterval, timeCalculator[periodType]);
            timeDomain.push(timeDomainElement.toDate());
          }

          return timeDomain;
        }

        function prepareResultMask (series) {
          var resultMask;

          resultMask = Object.keys(series).filter(function(seriesKey) {
            return ((series[seriesKey] === true) && (QUERY_RESULT_MASKS[seriesKey] != null));
          });

          resultMask = resultMask.map(function(seriesKey) {
            return QUERY_RESULT_MASKS[seriesKey];
          });

          return { ResultMask: [resultMask] };
        }

        function getCounterTrendData (nodeID, counter, dateFrom, dateTo, periodType,
                                      periodInterval, resultType) {

          //resultType possible values are :
          //    [ tqrAvg, tqrMin, tqrMax, tqrAvail, tqrDelta, tqrEqual, tqrDistr ]
          //Default tqrAvg is used : {ResultMask : [['tqrAvg']]}

          if ((nodeID == null) || (counter == null)) {
              return $q.when(null);
          }
          if (periodType == null) { periodType = PERIOD_TYPE.tpHours; }
          if (periodInterval == null) { periodInterval = 1; }

          resultType = (resultType == null) ? prepareResultMask({avg : true}) :
                                              prepareResultMask(resultType);
          if (resultType.ResultMask[0].length === 0) {
            resultType = prepareResultMask({avg : true});
          }

          return netCrunchRemoteSession.queryTrendData(nodeID.toString(), counter, periodType,
                                                       periodInterval,
                                                       dateFrom, dateTo, resultType,
                                                       null, // day mask just no mask
                                                       null) // value for equal checking
            .then(function (data) {
              return {
                domain : calculateTimeDomain(dateFrom, periodType, periodInterval, data.trend.length),
                values : data};
            });
        }

        function getCounterTrendRAWData (nodeID, counter, dateFrom, dateTo, resultType){
            return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpMinutes, 1,
                                       resultType);
        }

        function getCounterTrendMinutesData (nodeID, counter, dateFrom, dateTo, periodInterval,
                                             resultType){
            return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpMinutes,
                                       periodInterval, resultType);
        }

        function getCounterTrendHoursData (nodeID, counter, dateFrom, dateTo, periodInterval,
                                           resultType){
            return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpHours,
                                       periodInterval, resultType);
        }

        function getCounterTrendDaysData (nodeID, counter, dateFrom, dateTo, periodInterval, resultType){
            return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpDays,
                                       periodInterval, resultType);
        }

        function getCounterTrendMonthsData (nodeID, counter, dateFrom, dateTo, periodInterval,
                                            resultType){
            return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpMonths,
                                       periodInterval, resultType);
        }

        function getCounterData (nodeID, counterName, dateStart, dateEnd, maxSampleCount, resultType,
                                 period) {
          var counterTrends = Object.create(null),
              result = Object.create(null);

          dateEnd = dateEnd || moment();
          maxSampleCount = maxSampleCount || netCrunchChartDataProviderConsts.DEFAULT_MAX_SAMPLE_COUNT;
          period = period || calculateChartDataInterval(dateStart, dateEnd, maxSampleCount);

          counterTrends[PERIOD_TYPE.tpMinutes] = getCounterTrendMinutesData;
          counterTrends[PERIOD_TYPE.tpHours] = getCounterTrendHoursData;
          counterTrends[PERIOD_TYPE.tpDays] = getCounterTrendDaysData;
          counterTrends[PERIOD_TYPE.tpMonths] = getCounterTrendMonthsData;

          result.period = period;
          result.data = counterTrends[period.periodType](nodeID, counterName, dateStart, dateEnd,
                                                         period.periodInterval, resultType);
          return result;
        }

        function grafanaDataConverter (data) {
          return data.domain.map(function (time, $index) {
            return [data.values[$index], time.getTime()];
          });
        }

        return {
            PERIOD_TYPE : PERIOD_TYPE,
            QUERY_RESULT_MASKS : QUERY_RESULT_MASKS,
            calculateChartDataInterval : calculateChartDataInterval,
            calculateTimeDomain : calculateTimeDomain,
            prepareResultMask : prepareResultMask,
            getCounterTrendData : getCounterTrendData,
            getCounterTrendRAWData : getCounterTrendRAWData,
            getCounterTrendMinutesData : getCounterTrendMinutesData,
            getCounterTrendHoursData : getCounterTrendHoursData,
            getCounterTrendDaysData : getCounterTrendDaysData,
            getCounterTrendMonthsData : getCounterTrendMonthsData,
            getCounterData: getCounterData,
            grafanaDataConverter: grafanaDataConverter
        };
      });
});
