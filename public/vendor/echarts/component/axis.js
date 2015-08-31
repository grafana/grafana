/**
 * echarts组件类： 坐标轴
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * 直角坐标系中坐标轴数组，数组中每一项代表一条横轴（纵轴）坐标轴。
 * 标准（1.0）中规定最多同时存在2条横轴和2条纵轴
 *    单条横轴时可指定安放于grid的底部（默认）或顶部，2条同时存在时则默认第一条安放于底部，第二天安放于顶部
 *    单条纵轴时可指定安放于grid的左侧（默认）或右侧，2条同时存在时则默认第一条安放于左侧，第二天安放于右侧。
 * 坐标轴有两种类型，类目型和数值型（区别详见axis）：
 *    横轴通常为类目型，但条形图时则横轴为数值型，散点图时则横纵均为数值型
 *    纵轴通常为数值型，但条形图时则纵轴为类目型。
 *
 */
define(function (require) {
    var Base = require('./base');

    var LineShape = require('zrender/shape/Line');

    var ecConfig = require('../config');
    var ecData = require('../util/ecData');
    var zrUtil = require('zrender/tool/util');
    var zrColor = require('zrender/tool/color');

    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} option 图表选项
     *     @param {string=} option.xAxis.type 坐标轴类型，横轴默认为类目型'category'
     *     @param {string=} option.yAxis.type 坐标轴类型，纵轴默认为类目型'value'
     * @param {Object} component 组件
     * @param {string} axisType 横走or纵轴
     */
    function Axis(ecTheme, messageCenter, zr, option, myChart, axisType) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);

        this.axisType = axisType;
        this._axisList = [];

        this.refresh(option);
    }

    Axis.prototype = {
        type: ecConfig.COMPONENT_TYPE_AXIS,
        axisBase: {
            // 轴线
            _buildAxisLine: function () {
                var lineWidth = this.option.axisLine.lineStyle.width;
                var halfLineWidth = lineWidth / 2;
                var axShape = {
                    _axisShape: 'axisLine',
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase() + 3,
                    hoverable: false
                };
                var grid = this.grid;
                switch (this.option.position) {
                    case 'left' :
                        axShape.style = {
                            xStart: grid.getX() - halfLineWidth,
                            yStart: grid.getYend(),
                            xEnd: grid.getX() - halfLineWidth,
                            yEnd: grid.getY(),
                            lineCap: 'round'
                        };
                        break;
                    case 'right' :
                        axShape.style = {
                            xStart: grid.getXend() + halfLineWidth,
                            yStart: grid.getYend(),
                            xEnd: grid.getXend() + halfLineWidth,
                            yEnd: grid.getY(),
                            lineCap: 'round'
                        };
                        break;
                    case 'bottom' :
                        axShape.style = {
                            xStart: grid.getX(),
                            yStart: grid.getYend() + halfLineWidth,
                            xEnd: grid.getXend(),
                            yEnd: grid.getYend() + halfLineWidth,
                            lineCap: 'round'
                        };
                        break;
                    case 'top' :
                        axShape.style = {
                            xStart: grid.getX(),
                            yStart: grid.getY() - halfLineWidth,
                            xEnd: grid.getXend(),
                            yEnd: grid.getY() - halfLineWidth,
                            lineCap: 'round'
                        };
                        break;
                }
                var style = axShape.style;
                if (this.option.name !== '') { // 别帮我代码规范
                    style.text = this.option.name;
                    style.textPosition = this.option.nameLocation;
                    style.textFont = this.getFont(this.option.nameTextStyle);
                    if (this.option.nameTextStyle.align) {
                        style.textAlign = this.option.nameTextStyle.align;
                    }
                    if (this.option.nameTextStyle.baseline) {
                        style.textBaseline = this.option.nameTextStyle.baseline;
                    }
                    if (this.option.nameTextStyle.color) {
                        style.textColor = this.option.nameTextStyle.color;
                    }
                }
                style.strokeColor = this.option.axisLine.lineStyle.color;

                style.lineWidth = lineWidth;
                // 亚像素优化
                if (this.isHorizontal()) {
                    // 横向布局，优化y
                    style.yStart
                        = style.yEnd
                        = this.subPixelOptimize(style.yEnd, lineWidth);
                }
                else {
                    // 纵向布局，优化x
                    style.xStart
                        = style.xEnd
                        = this.subPixelOptimize(style.xEnd, lineWidth);
                }

                style.lineType = this.option.axisLine.lineStyle.type;

                axShape = new LineShape(axShape);
                this.shapeList.push(axShape);
            },

            _axisLabelClickable: function(clickable, axShape) {
                if (clickable) {
                    ecData.pack(
                        axShape, undefined, -1, undefined, -1, axShape.style.text
                    );
                    axShape.hoverable = true;
                    axShape.clickable = true;
                    axShape.highlightStyle = {
                        color: zrColor.lift(axShape.style.color, 1),
                        brushType: 'fill'
                    };
                    return axShape;
                }
                else {
                    return axShape;
                }
            },

            refixAxisShape: function(zeroX, zeroY) {
                if (!this.option.axisLine.onZero) {
                    return;
                }
                var tickLength;
                if (this.isHorizontal() && zeroY != null) {
                    // 横向布局调整纵向y
                    for (var i = 0, l = this.shapeList.length; i < l; i++) {
                        if (this.shapeList[i]._axisShape === 'axisLine') {
                            this.shapeList[i].style.yStart
                                = this.shapeList[i].style.yEnd
                                = this.subPixelOptimize(
                                    zeroY, this.shapeList[i].stylelineWidth
                                );
                            this.zr.modShape(this.shapeList[i].id);
                        }
                        else if (this.shapeList[i]._axisShape === 'axisTick') {
                            tickLength = this.shapeList[i].style.yEnd
                                         - this.shapeList[i].style.yStart;
                            this.shapeList[i].style.yStart = zeroY - tickLength;
                            this.shapeList[i].style.yEnd = zeroY;
                            this.zr.modShape(this.shapeList[i].id);
                        }
                    }
                }
                if (!this.isHorizontal() && zeroX != null) {
                    // 纵向布局调整横向x
                    for (var i = 0, l = this.shapeList.length; i < l; i++) {
                        if (this.shapeList[i]._axisShape === 'axisLine') {
                            this.shapeList[i].style.xStart
                                = this.shapeList[i].style.xEnd
                                = this.subPixelOptimize(
                                    zeroX, this.shapeList[i].stylelineWidth
                                );
                            this.zr.modShape(this.shapeList[i].id);
                        }
                        else if (this.shapeList[i]._axisShape === 'axisTick') {
                            tickLength = this.shapeList[i].style.xEnd
                                         - this.shapeList[i].style.xStart;
                            this.shapeList[i].style.xStart = zeroX;
                            this.shapeList[i].style.xEnd = zeroX + tickLength;
                            this.zr.modShape(this.shapeList[i].id);
                        }
                    }
                }
            },

            getPosition: function () {
                return this.option.position;
            },

            isHorizontal: function() {
                return this.option.position === 'bottom' || this.option.position === 'top';
            }
        },
        /**
         * 参数修正&默认值赋值，重载基类方法
         * @param {Object} opt 参数
         */
        reformOption: function (opt) {
            // 不写或传了个空数值默认为数值轴
            if (!opt || (opt instanceof Array && opt.length === 0)) {
                opt = [ { type: ecConfig.COMPONENT_TYPE_AXIS_VALUE } ];
            }
            else if (!(opt instanceof Array)){
                opt = [opt];
            }

            // 最多两条，其他参数忽略
            if (opt.length > 2) {
                opt = [opt[0], opt[1]];
            }

            if (this.axisType === 'xAxis') {
                // 横轴位置默认配置
                if (!opt[0].position            // 没配置或配置错
                    || (opt[0].position != 'bottom' && opt[0].position != 'top')
                ) {
                    opt[0].position = 'bottom';
                }
                if (opt.length > 1) {
                    opt[1].position = opt[0].position === 'bottom' ? 'top' : 'bottom';
                }

                for (var i = 0, l = opt.length; i < l; i++) {
                    // 坐标轴类型，横轴默认为类目型'category'
                    opt[i].type = opt[i].type || 'category';
                    // 标识轴类型&索引
                    opt[i].xAxisIndex = i;
                    opt[i].yAxisIndex = -1;
                }
            }
            else {
                // 纵轴位置默认配置
                if (!opt[0].position            // 没配置或配置错
                    || (opt[0].position != 'left'  && opt[0].position != 'right')
                ) {
                    opt[0].position = 'left';
                }

                if (opt.length > 1) {
                    opt[1].position = opt[0].position === 'left' ? 'right' : 'left';
                }

                for (var i = 0, l = opt.length; i < l; i++) {
                    // 坐标轴类型，纵轴默认为数值型'value'
                    opt[i].type = opt[i].type || 'value';
                    // 标识轴类型&索引
                    opt[i].xAxisIndex = -1;
                    opt[i].yAxisIndex = i;
                }
            }

            return opt;
        },

        /**
         * 刷新
         */
        refresh: function (newOption) {
            var axisOption;
            if (newOption) {
                this.option = newOption;
                if (this.axisType === 'xAxis') {
                    this.option.xAxis = this.reformOption(newOption.xAxis);
                    axisOption = this.option.xAxis;
                }
                else {
                    this.option.yAxis = this.reformOption(newOption.yAxis);
                    axisOption = this.option.yAxis;
                }
                this.series = newOption.series;
            }

            var CategoryAxis = require('./categoryAxis');
            var ValueAxis = require('./valueAxis');
            var len = Math.max((axisOption && axisOption.length || 0), this._axisList.length);
            for (var i = 0; i < len; i++) {
                if (this._axisList[i]   // 已有实例
                    && newOption        // 非空刷新
                    && (!axisOption[i] || this._axisList[i].type != axisOption[i].type) // 类型不匹配
                ) {
                    this._axisList[i].dispose && this._axisList[i].dispose();
                    this._axisList[i] = false;
                }

                if (this._axisList[i]) {
                    this._axisList[i].refresh && this._axisList[i].refresh(
                        axisOption ? axisOption[i] : false,
                        this.series
                    );
                }
                else if (axisOption && axisOption[i]) {
                    this._axisList[i] = axisOption[i].type === 'category'
                        ? new CategoryAxis(
                               this.ecTheme, this.messageCenter, this.zr,
                               axisOption[i], this.myChart, this.axisBase
                           )
                        : new ValueAxis(
                               this.ecTheme, this.messageCenter, this.zr,
                               axisOption[i], this.myChart, this.axisBase,
                               this.series
                        );
                }
            }
        },

        /**
         * 根据值换算位置
         * @param {number} idx 坐标轴索引0~1
         */
        getAxis: function (idx) {
            return this._axisList[idx];
        },

        getAxisCount: function () {
            return this._axisList.length;
        },

        clear: function () {
            for (var i = 0, l = this._axisList.length; i < l; i++) {
                this._axisList[i].dispose && this._axisList[i].dispose();
            }
            this._axisList = [];
        }
    };

    zrUtil.inherits(Axis, Base);

    require('../component').define('axis', Axis);

    return Axis;
});
