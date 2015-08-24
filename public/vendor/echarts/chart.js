/**
 * echart图表库
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 */
define(function (/*require*/) {     //chart
    var self = {};

    var _chartLibrary = {};         //echart图表库

    /**
     * 定义图形实现
     * @param {Object} name
     * @param {Object} clazz 图形实现
     */
    self.define = function (name, clazz) {
        // console.log('chartLibrary.define name =', name);
        // console.log('chartLibrary.define clazz =', clazz);
        _chartLibrary[name] = clazz;
        return self;
    };

    /**
     * 获取图形实现
     * @param {Object} name
     */
    self.get = function (name) {
        // console.log('chartLibrary.get name =', name);
        return _chartLibrary[name];
    };

    return self;
});