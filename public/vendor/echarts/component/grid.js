/**
 * echarts组件： 网格
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var Base = require('./base');
    
    // 图形依赖
    var RectangleShape = require('zrender/shape/Rectangle');
    
    var ecConfig = require('../config');
    // 网格
    ecConfig.grid = {
        zlevel: 0,                  // 一级层叠
        z: 0,                       // 二级层叠
        x: 80,
        y: 60,
        x2: 80,
        y2: 60,
        // width: {totalWidth} - x - x2,
        // height: {totalHeight} - y - y2,
        backgroundColor: 'rgba(0,0,0,0)',
        borderWidth: 1,
        borderColor: '#ccc'
    };

    var zrUtil = require('zrender/tool/util');

    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} option 图表选项
     *      @param {number=} option.grid.x 直角坐标系内绘图网格起始横坐标，数值单位px
     *      @param {number=} option.grid.y 直角坐标系内绘图网格起始纵坐标，数值单位px
     *      @param {number=} option.grid.width 直角坐标系内绘图网格宽度，数值单位px
     *      @param {number=} option.grid.height 直角坐标系内绘图网格高度，数值单位px
     */
    function Grid(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);

        this.refresh(option);
    }
    
    Grid.prototype = {
        type: ecConfig.COMPONENT_TYPE_GRID,

        getX: function () {
            return this._x;
        },

        getY: function () {
            return this._y;
        },

        getWidth: function () {
            return this._width;
        },

        getHeight: function () {
            return this._height;
        },

        getXend: function () {
            return this._x + this._width;
        },

        getYend: function () {
            return this._y + this._height;
        },

        getArea: function () {
            return {
                x: this._x,
                y: this._y,
                width: this._width,
                height: this._height
            };
        },
        
        getBbox: function() {
            return [
                [ this._x, this._y ],
                [ this.getXend(), this.getYend() ]
            ];
        },
        
        /**
         * 实在找不到合适的地方做了，各种粗暴的写法~ -_-
         */
        refixAxisShape: function(component) {
            var zeroX;
            var zeroY;
            var axisList = component.xAxis._axisList.concat(
                component.yAxis ? component.yAxis._axisList : []
            );
            var len = axisList.length;
            var axis;
            while (len--) {
                axis = axisList[len];
                if (axis.type == ecConfig.COMPONENT_TYPE_AXIS_VALUE 
                    && axis._min < 0  
                    && axis._max >= 0
                ) {
                    axis.isHorizontal()
                    ? (zeroX = axis.getCoord(0))
                    : (zeroY = axis.getCoord(0));
                }
            }
            if (typeof zeroX != 'undefined' || typeof zeroY != 'undefined') {
                len = axisList.length;
                while (len--) {
                    axisList[len].refixAxisShape(zeroX, zeroY);
                }
            }
        },
        
        refresh: function (newOption) {
            if (newOption
                || this._zrWidth != this.zr.getWidth() 
                || this._zrHeight != this.zr.getHeight()
            ) {
                this.clear();
                this.option = newOption || this.option;
                this.option.grid = this.reformOption(this.option.grid);
    
                var gridOption = this.option.grid;
                this._zrWidth = this.zr.getWidth();
                this._zrHeight = this.zr.getHeight();
                this._x = this.parsePercent(gridOption.x, this._zrWidth);
                this._y = this.parsePercent(gridOption.y, this._zrHeight);
                var x2 = this.parsePercent(gridOption.x2, this._zrWidth);
                var y2 = this.parsePercent(gridOption.y2, this._zrHeight);
                
    
                if (typeof gridOption.width == 'undefined') {
                    this._width = this._zrWidth - this._x - x2;
                }
                else {
                    this._width = this.parsePercent(gridOption.width, this._zrWidth);
                }
                this._width = this._width <= 0 ? 10 : this._width;
    
                if (typeof gridOption.height == 'undefined') {
                    this._height = this._zrHeight - this._y - y2;
                }
                else {
                    this._height = this.parsePercent(gridOption.height, this._zrHeight);
                }
                this._height = this._height <= 0 ? 10 : this._height;
                
                this._x = this.subPixelOptimize(this._x, gridOption.borderWidth);
                this._y = this.subPixelOptimize(this._y, gridOption.borderWidth);
    
                this.shapeList.push(new RectangleShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    hoverable: false,
                    style: {
                        x: this._x,
                        y: this._y,
                        width: this._width,
                        height: this._height,
                        brushType: gridOption.borderWidth > 0 ? 'both' : 'fill',
                        color: gridOption.backgroundColor,
                        strokeColor: gridOption.borderColor,
                        lineWidth: gridOption.borderWidth
                        // type: this.option.splitArea.areaStyle.type,
                    }
                }));
                this.zr.addShape(this.shapeList[0]);
            }
        }
    };
    
    zrUtil.inherits(Grid, Base);
    
    require('../component').define('grid', Grid);
    
    return Grid;
});