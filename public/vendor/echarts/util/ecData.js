/**
 * echarts通用私有数据服务
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function() {
    /**
     * 打包私有数据
     *
     * @param {shape} shape 修改目标
     * @param {Object} series
     * @param {number} seriesIndex
     * @param {number | Object} data
     * @param {number} dataIndex
     * @param {*=} special
     * @param {*=} special2
     */
    function pack(
        shape, series, seriesIndex, data, dataIndex, name, special, special2
    ) {
        var value;
        if (typeof data != 'undefined') {
            value = data.value == null
                ? data
                : data.value;
        }

        shape._echartsData = {
            '_series' : series,
            '_seriesIndex' : seriesIndex,
            '_data' : data,
            '_dataIndex' : dataIndex,
            '_name' : name,
            '_value' : value,
            '_special' : special,
            '_special2' : special2
        };
        return shape._echartsData;
    }

    /**
     * 从私有数据中获取特定项
     * @param {shape} shape
     * @param {string} key
     */
    function get(shape, key) {
        var data = shape._echartsData;
        if (!key) {
            return data;
        }

        switch (key) {
            case 'series' :
            case 'seriesIndex' :
            case 'data' :
            case 'dataIndex' :
            case 'name' :
            case 'value' :
            case 'special' :
            case 'special2' :
                return data && data['_' + key];
        }

        return null;
    }

    /**
     * 修改私有数据中获取特定项
     * @param {shape} shape
     * @param {string} key
     * @param {*} value
     */
    function set(shape, key, value) {
        shape._echartsData = shape._echartsData || {};
        switch (key) {
            case 'series' :             // 当前系列值
            case 'seriesIndex' :        // 系列数组位置索引
            case 'data' :               // 当前数据值
            case 'dataIndex' :          // 数据数组位置索引
            case 'name' :
            case 'value' :
            case 'special' :
            case 'special2' :
                shape._echartsData['_' + key] = value;
                break;
        }
    }
    
    /**
     * 私有数据克隆，把source拷贝到target上
     * @param {shape} source 源
     * @param {shape} target 目标
     */
    function clone(source, target) {
        target._echartsData =  {
            '_series' : source._echartsData._series,
            '_seriesIndex' : source._echartsData._seriesIndex,
            '_data' : source._echartsData._data,
            '_dataIndex' : source._echartsData._dataIndex,
            '_name' : source._echartsData._name,
            '_value' : source._echartsData._value,
            '_special' : source._echartsData._special,
            '_special2' : source._echartsData._special2
        };
    }

    return {
        pack : pack,
        set : set,
        get : get,
        clone : clone
    };
});