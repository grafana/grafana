/**
 * echarts组件基类
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var ecConfig = require('../config');
    var ecData = require('../util/ecData');
    var ecQuery = require('../util/ecQuery');
    var number = require('../util/number');
    var zrUtil = require('zrender/tool/util');
    
    function Base(ecTheme, messageCenter, zr, option, myChart){
        this.ecTheme = ecTheme;
        this.messageCenter = messageCenter;
        this.zr =zr;
        this.option = option;
        this.series = option.series;
        this.myChart = myChart;
        this.component = myChart.component;

        this.shapeList = [];
        this.effectList = [];
        
        var self = this;
        
        self._onlegendhoverlink = function(param) {
            if (self.legendHoverLink) {
                var targetName = param.target;
                var name;
                for (var i = self.shapeList.length - 1; i >= 0; i--) {
                    name = self.type == ecConfig.CHART_TYPE_PIE
                           || self.type == ecConfig.CHART_TYPE_FUNNEL
                           ? ecData.get(self.shapeList[i], 'name')
                           : (ecData.get(self.shapeList[i], 'series') || {}).name;
                    if (name == targetName 
                        && !self.shapeList[i].invisible 
                        && !self.shapeList[i].__animating
                    ) {
                        self.zr.addHoverShape(self.shapeList[i]);
                    }
                }
            }
        };
        messageCenter && messageCenter.bind(
            ecConfig.EVENT.LEGEND_HOVERLINK, this._onlegendhoverlink
        );
    }

    /**
     * 基类方法
     */
    Base.prototype = {
        canvasSupported: require('zrender/tool/env').canvasSupported,
        _getZ : function(zWhat) {
            if (this[zWhat] != null) {
                return this[zWhat];
            }
            var opt = this.ecTheme[this.type];
            if (opt && opt[zWhat] != null) {
                return opt[zWhat];
            }
            opt = ecConfig[this.type];
            if (opt && opt[zWhat] != null) {
                return opt[zWhat];
            }
            return 0;
        },

        /**
         * 获取zlevel基数配置
         */
        getZlevelBase: function () {
            return this._getZ('zlevel');
        },
        
        /**
         * 获取z基数配置
         */
        getZBase: function() {
            return this._getZ('z');
        },

        /**
         * 参数修正&默认值赋值
         * @param {Object} opt 参数
         *
         * @return {Object} 修正后的参数
         */
        reformOption: function (opt) {
            // 默认配置项动态多级合并，依赖加载的组件选项未被merge到ecTheme里，需要从config里取
            opt = zrUtil.merge(
                       zrUtil.merge(
                           opt || {},
                           zrUtil.clone(this.ecTheme[this.type] || {})
                       ),
                       zrUtil.clone(ecConfig[this.type] || {})
                   );
            this.z = opt.z;
            this.zlevel = opt.zlevel;
            return opt;
        },
        
        /**
         * css类属性数组补全，如padding，margin等~
         */
        reformCssArray: function (p) {
            if (p instanceof Array) {
                switch (p.length + '') {
                    case '4':
                        return p;
                    case '3':
                        return [p[0], p[1], p[2], p[1]];
                    case '2':
                        return [p[0], p[1], p[0], p[1]];
                    case '1':
                        return [p[0], p[0], p[0], p[0]];
                    case '0':
                        return [0, 0, 0, 0];
                }
            }
            else {
                return [p, p, p, p];
            }
        },
        
        getShapeById: function(id) {
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                if (this.shapeList[i].id === id) {
                    return this.shapeList[i];
                }
            }
            return null;
        },
        
        /**
         * 获取自定义和默认配置合并后的字体设置
         */
        getFont: function (textStyle) {
            var finalTextStyle = this.getTextStyle(
                zrUtil.clone(textStyle)
            );
            return finalTextStyle.fontStyle + ' '
                   + finalTextStyle.fontWeight + ' '
                   + finalTextStyle.fontSize + 'px '
                   + finalTextStyle.fontFamily;
        },

        /**
         * 获取统一主题字体样式
         */
        getTextStyle: function(targetStyle) {
            return zrUtil.merge(
                       zrUtil.merge(
                           targetStyle || {},
                           this.ecTheme.textStyle
                       ),
                       ecConfig.textStyle
                   );
        },
        
        getItemStyleColor: function (itemColor, seriesIndex, dataIndex, data) {
            return typeof itemColor === 'function'
                   ? itemColor.call(
                        this.myChart,
                        {
                            seriesIndex: seriesIndex,
                            series: this.series[seriesIndex],
                            dataIndex: dataIndex,
                            data: data
                        }
                   )
                   : itemColor;
            
        }, 

        /**
         * @parmas {object | number} data 目标data
         * @params {string= | number=} defaultData 无数据时默认返回
         */
        getDataFromOption: function (data, defaultData) {
            return data != null ? (data.value != null ? data.value : data) : defaultData;
        },
        
        // 亚像素优化
        subPixelOptimize: function (position, lineWidth) {
            if (lineWidth % 2 === 1) {
                //position += position === Math.ceil(position) ? 0.5 : 0;
                position = Math.floor(position) + 0.5;
            }
            else {
                position = Math.round(position);
            }
            return position;
        },
        
        // 默认resize
        resize: function () {
            this.refresh && this.refresh();
            this.clearEffectShape && this.clearEffectShape(true);
            var self = this;
            setTimeout(function(){
                self.animationEffect && self.animationEffect();
            },200);
        },

        /**
         * 清除图形数据，实例仍可用
         */
        clear :function () {
            this.clearEffectShape && this.clearEffectShape();
            this.zr && this.zr.delShape(this.shapeList);
            this.shapeList = [];
        },

        /**
         * 释放后实例不可用
         */
        dispose: function () {
            this.onbeforDispose && this.onbeforDispose();
            this.clear();
            this.shapeList = null;
            this.effectList = null;
            this.messageCenter && this.messageCenter.unbind(
                ecConfig.EVENT.LEGEND_HOVERLINK, this._onlegendhoverlink
            );
            this.onafterDispose && this.onafterDispose();
        },
        
        query: ecQuery.query,
        deepQuery: ecQuery.deepQuery,
        deepMerge: ecQuery.deepMerge,
        
        parsePercent: number.parsePercent,
        parseCenter: number.parseCenter,
        parseRadius: number.parseRadius,
        numAddCommas: number.addCommas,

        getPrecision: number.getPrecision
    };
    
    return Base;
});
