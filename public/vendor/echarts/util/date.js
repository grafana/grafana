/**
 * echarts日期运算格式化相关
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function() {
    var _timeGap = [
        {formatter: 'hh : mm : ss', value: 1000},               // 1s
        {formatter: 'hh : mm : ss', value: 1000 * 5},           // 5s
        {formatter: 'hh : mm : ss', value: 1000 * 10},          // 10s
        {formatter: 'hh : mm : ss', value: 1000 * 15},          // 15s
        {formatter: 'hh : mm : ss', value: 1000 * 30},          // 30s
        {formatter: 'hh : mm\nMM - dd', value: 60000},          // 1m
        {formatter: 'hh : mm\nMM - dd', value: 60000 * 5},      // 5m
        {formatter: 'hh : mm\nMM - dd', value: 60000 * 10},     // 10m
        {formatter: 'hh : mm\nMM - dd', value: 60000 * 15},     // 15m
        {formatter: 'hh : mm\nMM - dd', value: 60000 * 30},     // 30m
        {formatter: 'hh : mm\nMM - dd', value: 3600000},        // 1h
        {formatter: 'hh : mm\nMM - dd', value: 3600000 * 2},    // 2h
        {formatter: 'hh : mm\nMM - dd', value: 3600000 * 6},    // 6h
        {formatter: 'hh : mm\nMM - dd', value: 3600000 * 12},   // 12h
        {formatter: 'MM - dd\nyyyy', value: 3600000 * 24},      // 1d
        {formatter: 'week', value: 3600000 * 24 * 7},           // 7d
        {formatter: 'month', value: 3600000 * 24 * 31},         // 1M
        {formatter: 'quarter', value: 3600000 * 24 * 380 / 4},  // 3M
        {formatter: 'half-year', value: 3600000 * 24 * 380 / 2},// 6M
        {formatter: 'year', value: 3600000 * 24 * 380}          // 1Y
    ];
    
    /**
     * 获取最佳formatter
     * @params {number} min 最小值
     * @params {number} max 最大值
     * @params {=number} splitNumber 分隔段数
     */
    function getAutoFormatter(min, max, splitNumber) {
        splitNumber = splitNumber > 1 ? splitNumber : 2;
        // 最优解
        var curValue;
        var totalGap;
        // 目标
        var formatter;
        var gapValue;
        for (var i = 0, l = _timeGap.length; i < l; i++) {
            curValue = _timeGap[i].value;
            totalGap = Math.ceil(max / curValue) * curValue 
                       - Math.floor(min / curValue) * curValue;
            if (Math.round(totalGap / curValue) <= splitNumber * 1.2) {
                formatter =  _timeGap[i].formatter;
                gapValue = _timeGap[i].value;
                // console.log(formatter, gapValue,i);
                break;
            }
        }
        
        if (formatter == null) {
            formatter = 'year';
            curValue = 3600000 * 24 * 367;
            totalGap = Math.ceil(max / curValue) * curValue 
                       - Math.floor(min / curValue) * curValue;
            gapValue = Math.round(totalGap / (splitNumber - 1) / curValue) * curValue;
        }
        
        return {
            formatter: formatter,
            gapValue: gapValue
        };
    }
    
    /**
     * 一位数字补0 
     */
    function s2d (v) {
        return v < 10 ? ('0' + v) : v;
    }
    
    /**
     * 百分比计算
     */
    function format(formatter, value) {
        if (formatter == 'week' 
            || formatter == 'month' 
            || formatter == 'quarter' 
            || formatter == 'half-year'
            || formatter == 'year'
        ) {
            formatter = 'MM - dd\nyyyy';
        }
            
        var date = getNewDate(value);
        var y = date.getFullYear();
        var M = date.getMonth() + 1;
        var d = date.getDate();
        var h = date.getHours();
        var m = date.getMinutes();
        var s = date.getSeconds();
        
        formatter = formatter.replace('MM', s2d(M));
        formatter = formatter.toLowerCase();
        formatter = formatter.replace('yyyy', y);
        formatter = formatter.replace('yy', y % 100);
        formatter = formatter.replace('dd', s2d(d));
        formatter = formatter.replace('d', d);
        formatter = formatter.replace('hh', s2d(h));
        formatter = formatter.replace('h', h);
        formatter = formatter.replace('mm', s2d(m));
        formatter = formatter.replace('m', m);
        formatter = formatter.replace('ss', s2d(s));
        formatter = formatter.replace('s', s);

        return formatter;
    }
    
    function nextMonday(value) {
        value = getNewDate(value);
        value.setDate(value.getDate() + 8 - value.getDay());
        return value;
    }
    
    function nextNthPerNmonth(value, nth, nmon) {
        value = getNewDate(value);
        value.setMonth(Math.ceil((value.getMonth() + 1) / nmon) * nmon);
        value.setDate(nth);
        return value;
    }
    
    function nextNthOnMonth(value, nth) {
        return nextNthPerNmonth(value, nth, 1);
    }
    
    function nextNthOnQuarterYear(value, nth) {
        return nextNthPerNmonth(value, nth, 3);
    }
    
    function nextNthOnHalfYear(value, nth) {
        return nextNthPerNmonth(value, nth, 6);
    }
    
    function nextNthOnYear(value, nth) {
        return nextNthPerNmonth(value, nth, 12);
    }
    
    function getNewDate(value) {
        return value instanceof Date
               ? value
               : new Date(typeof value == 'string' ? value.replace(/-/g, '/') : value);
    }
    
    return {
        getAutoFormatter: getAutoFormatter,
        getNewDate: getNewDate,
        format: format,
        nextMonday: nextMonday,
        nextNthPerNmonth: nextNthPerNmonth,
        nextNthOnMonth: nextNthOnMonth,
        nextNthOnQuarterYear: nextNthOnQuarterYear,
        nextNthOnHalfYear: nextNthOnHalfYear,
        nextNthOnYear : nextNthOnYear
    };
});