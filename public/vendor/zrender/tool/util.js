/**
 * @module zrender/tool/util
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *         Yi Shen(https://github.com/pissang)
 */
define(
    function(require) {

        var ArrayProto = Array.prototype;
        var nativeForEach = ArrayProto.forEach;
        var nativeMap = ArrayProto.map;
        var nativeFilter = ArrayProto.filter;

        // 用于处理merge时无法遍历Date等对象的问题
        var BUILTIN_OBJECT = {
            '[object Function]': 1,
            '[object RegExp]': 1,
            '[object Date]': 1,
            '[object Error]': 1,
            '[object CanvasGradient]': 1
        };

        var objToString = Object.prototype.toString;

        function isDom(obj) {
            return obj && obj.nodeType === 1
                   && typeof(obj.nodeName) == 'string';
        }

        /**
         * 对一个object进行深度拷贝
         * @memberOf module:zrender/tool/util
         * @param {*} source 需要进行拷贝的对象
         * @return {*} 拷贝后的新对象
         */
        function clone(source) {
            if (typeof source == 'object' && source !== null) {
                var result = source;
                if (source instanceof Array) {
                    result = [];
                    for (var i = 0, len = source.length; i < len; i++) {
                        result[i] = clone(source[i]);
                    }
                }
                else if (
                    !BUILTIN_OBJECT[objToString.call(source)]
                    // 是否为 dom 对象
                    && !isDom(source)
                ) {
                    result = {};
                    for (var key in source) {
                        if (source.hasOwnProperty(key)) {
                            result[key] = clone(source[key]);
                        }
                    }
                }

                return result;
            }

            return source;
        }

        function mergeItem(target, source, key, overwrite) {
            if (source.hasOwnProperty(key)) {
                var targetProp = target[key];
                if (typeof targetProp == 'object'
                    && !BUILTIN_OBJECT[objToString.call(targetProp)]
                    // 是否为 dom 对象
                    && !isDom(targetProp)
                ) {
                    // 如果需要递归覆盖，就递归调用merge
                    merge(
                        target[key],
                        source[key],
                        overwrite
                    );
                }
                else if (overwrite || !(key in target)) {
                    // 否则只处理overwrite为true，或者在目标对象中没有此属性的情况
                    target[key] = source[key];
                }
            }
        }

        /**
         * 合并源对象的属性到目标对象
         * @memberOf module:zrender/tool/util
         * @param {*} target 目标对象
         * @param {*} source 源对象
         * @param {boolean} overwrite 是否覆盖
         */
        function merge(target, source, overwrite) {
            for (var i in source) {
                mergeItem(target, source, i, overwrite);
            }
            
            return target;
        }

        var _ctx;

        function getContext() {
            if (!_ctx) {
                require('../dep/excanvas');
                /* jshint ignore:start */
                if (window['G_vmlCanvasManager']) {
                    var _div = document.createElement('div');
                    _div.style.position = 'absolute';
                    _div.style.top = '-1000px';
                    document.body.appendChild(_div);

                    _ctx = G_vmlCanvasManager.initElement(_div)
                               .getContext('2d');
                }
                else {
                    _ctx = document.createElement('canvas').getContext('2d');
                }
                /* jshint ignore:end */
            }
            return _ctx;
        }

        /**
         * @memberOf module:zrender/tool/util
         * @param {Array} array
         * @param {*} value
         */
        function indexOf(array, value) {
            if (array.indexOf) {
                return array.indexOf(value);
            }
            for (var i = 0, len = array.length; i < len; i++) {
                if (array[i] === value) {
                    return i;
                }
            }
            return -1;
        }

        /**
         * 构造类继承关系
         * @memberOf module:zrender/tool/util
         * @param {Function} clazz 源类
         * @param {Function} baseClazz 基类
         */
        function inherits(clazz, baseClazz) {
            var clazzPrototype = clazz.prototype;
            function F() {}
            F.prototype = baseClazz.prototype;
            clazz.prototype = new F();

            for (var prop in clazzPrototype) {
                clazz.prototype[prop] = clazzPrototype[prop];
            }
            clazz.constructor = clazz;
        }

        /**
         * 数组或对象遍历
         * @memberOf module:zrender/tool/util
         * @param {Object|Array} obj
         * @param {Function} cb
         * @param {*} [context]
         */
        function each(obj, cb, context) {
            if (!(obj && cb)) {
                return;
            }
            if (obj.forEach && obj.forEach === nativeForEach) {
                obj.forEach(cb, context);
            }
            else if (obj.length === +obj.length) {
                for (var i = 0, len = obj.length; i < len; i++) {
                    cb.call(context, obj[i], i, obj);
                }
            }
            else {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        cb.call(context, obj[key], key, obj);
                    }
                }
            }
        }

        /**
         * 数组映射
         * @memberOf module:zrender/tool/util
         * @param {Array} obj
         * @param {Function} cb
         * @param {*} [context]
         * @return {Array}
         */
        function map(obj, cb, context) {
            if (!(obj && cb)) {
                return;
            }
            if (obj.map && obj.map === nativeMap) {
                return obj.map(cb, context);
            }
            else {
                var result = [];
                for (var i = 0, len = obj.length; i < len; i++) {
                    result.push(cb.call(context, obj[i], i, obj));
                }
                return result;
            }
        }

        /**
         * 数组过滤
         * @memberOf module:zrender/tool/util
         * @param {Array} obj
         * @param {Function} cb
         * @param {*} [context]
         * @return {Array}
         */
        function filter(obj, cb, context) {
            if (!(obj && cb)) {
                return;
            }
            if (obj.filter && obj.filter === nativeFilter) {
                return obj.filter(cb, context);
            }
            else {
                var result = [];
                for (var i = 0, len = obj.length; i < len; i++) {
                    if (cb.call(context, obj[i], i, obj)) {
                        result.push(obj[i]);
                    }
                }
                return result;
            }
        }

        function bind(func, context) {
            
            return function () {
                func.apply(context, arguments);
            }
        }

        return {
            inherits: inherits,
            clone: clone,
            merge: merge,
            getContext: getContext,
            indexOf: indexOf,
            each: each,
            map: map,
            filter: filter,
            bind: bind
        };
    }
);
