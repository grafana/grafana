/**
 * echarts数字运算相关
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function() {
    function _trim(str) {
        return str.replace(/^\s+/, '').replace(/\s+$/, '');
    }
    
    /**
     * 百分比计算
     */
    function parsePercent(value, maxValue) {
        if (typeof value === 'string') {
            if (_trim(value).match(/%$/)) {
                return parseFloat(value) / 100 * maxValue;
            }

            return parseFloat(value);
        }

        return value;
    }
    
    /**
     * 获取中心坐标
     */ 
    function parseCenter(zr, center) {
        return [
            parsePercent(center[0], zr.getWidth()),
            parsePercent(center[1], zr.getHeight())
        ];
    }

    /**
     * 获取自适应半径
     */ 
    function parseRadius(zr, radius) {
        // 传数组实现环形图，[内半径，外半径]，传单个则默认为外半径为
        if (!(radius instanceof Array)) {
            radius = [0, radius];
        }
        var zrSize = Math.min(zr.getWidth(), zr.getHeight()) / 2;
        return [
            parsePercent(radius[0], zrSize),
            parsePercent(radius[1], zrSize)
        ];
    }
    
    /**
     * 每三位默认加,格式化
     */
    function addCommas(x) {
        if (isNaN(x)) {
            return '-';
        }
        x = (x + '').split('.');
        return x[0].replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g,'$1,') 
               + (x.length > 1 ? ('.' + x[1]) : '');
    }

    /**
     * 获取数字的小数位数
     * @param {number} val
     */
    
    // It is much faster than methods converting number to string as follows 
    //      var tmp = val.toString();
    //      return tmp.length - 1 - tmp.indexOf('.');
    // especially when precision is low
    function getPrecision(val) {
        var e = 1;
        var count = 0;
        while (Math.round(val * e) / e !== val) {
            e *= 10;
            count++;
        }
        return count;
    }
    
    return {
        parsePercent: parsePercent,
        parseCenter: parseCenter,
        parseRadius: parseRadius,
        addCommas: addCommas,
        getPrecision: getPrecision
    };
});