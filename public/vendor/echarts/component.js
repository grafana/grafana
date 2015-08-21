/**
 * echart组件库
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (/*require*/) {     // component
    var self = {};

    var _componentLibrary = {};     // echart组件库

    /**
     * 定义图形实现
     * @param {Object} name
     * @param {Object} clazz 图形实现
     */
    self.define = function (name, clazz) {
        // console.log('componentLibrary.define() name =', name);
        // console.log('componentLibrary.define() clazz =', clazz);
        _componentLibrary[name] = clazz;
        // console.log('_componentLibrary =', _componentLibrary);
        _componentLibrary.name = clazz;
        // console.log('_componentLibrary =', _componentLibrary);
        // console.log('typeof(_componentLibrary) =', typeof(_componentLibrary));
        return self;
    };

    /**
     * 获取图形实现
     * @param {Object} name
     */
    self.get = function (name) {
        // console.log('componentLibrary.get() name =', name);
        // console.log('_componentLibrary =', _componentLibrary);
        return _componentLibrary[name];
    };
    
    return self;
});