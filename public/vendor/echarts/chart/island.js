/**
 * echarts组件：孤岛数据
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var ChartBase = require('./base');
    
    // 图形依赖
    var CircleShape = require('zrender/shape/Circle');
    
    var ecConfig = require('../config');
    ecConfig.island = {
        zlevel: 0,                  // 一级层叠
        z: 5,                       // 二级层叠
        r: 15,
        calculateStep: 0.1  // 滚轮可计算步长 0.1 = 10%
    };

    var ecData = require('../util/ecData');
    var zrUtil = require('zrender/tool/util');
    var zrEvent = require('zrender/tool/event');
    
    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} option 图表选项
     */
    function Island(ecTheme, messageCenter, zr, option, myChart) {
        // 图表基类
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);

        this._nameConnector;
        this._valueConnector;
        this._zrHeight = this.zr.getHeight();
        this._zrWidth = this.zr.getWidth();

        var self = this;
        /**
         * 滚轮改变孤岛数据值
         */
        self.shapeHandler.onmousewheel = function (param) {
            var shape = param.target;

            var event = param.event;
            var delta = zrEvent.getDelta(event);
            delta = delta > 0 ? (-1) : 1;
            shape.style.r -= delta;
            shape.style.r = shape.style.r < 5 ? 5 : shape.style.r;

            var value = ecData.get(shape, 'value');
            var dvalue = value * self.option.island.calculateStep;
            value = dvalue > 1
                    ? (Math.round(value - dvalue * delta))
                    : +(value - dvalue * delta).toFixed(2);

            var name = ecData.get(shape, 'name');
            shape.style.text = name + ':' + value;

            ecData.set(shape, 'value', value);
            ecData.set(shape, 'name', name);

            self.zr.modShape(shape.id);
            self.zr.refreshNextFrame();
            zrEvent.stop(event);
        };
    }
    
    Island.prototype = {
        type: ecConfig.CHART_TYPE_ISLAND,
        /**
         * 孤岛合并
         *
         * @param {string} tarShapeIndex 目标索引
         * @param {Object} srcShape 源目标，合入目标后删除
         */
        _combine: function (tarShape, srcShape) {
            var zrColor = require('zrender/tool/color');
            var accMath = require('../util/accMath');
            var value = accMath.accAdd(
                            ecData.get(tarShape, 'value'),
                            ecData.get(srcShape, 'value')
                        );
            var name = ecData.get(tarShape, 'name')
                       + this._nameConnector
                       + ecData.get(srcShape, 'name');

            tarShape.style.text = name + this._valueConnector + value;

            ecData.set(tarShape, 'value', value);
            ecData.set(tarShape, 'name', name);
            tarShape.style.r = this.option.island.r;
            tarShape.style.color = zrColor.mix(
                tarShape.style.color,
                srcShape.style.color
            );
        },

        /**
         * 刷新
         */
        refresh: function (newOption) {
            if (newOption) {
                newOption.island = this.reformOption(newOption.island);
                this.option = newOption;
    
                this._nameConnector = this.option.nameConnector;
                this._valueConnector = this.option.valueConnector;
            }
        },
        
        getOption: function () {
            return this.option;
        },

        resize: function () {
            var newWidth = this.zr.getWidth();
            var newHieght = this.zr.getHeight();
            var xScale = newWidth / (this._zrWidth || newWidth);
            var yScale = newHieght / (this._zrHeight || newHieght);
            if (xScale === 1 && yScale === 1) {
                return;
            }
            this._zrWidth = newWidth;
            this._zrHeight = newHieght;
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.modShape(
                    this.shapeList[i].id,
                    {
                        style: {
                            x: Math.round(this.shapeList[i].style.x * xScale),
                            y: Math.round(this.shapeList[i].style.y * yScale)
                        }
                    }
                );
            }
        },

        add: function (shape) {
            var name = ecData.get(shape, 'name');
            var value = ecData.get(shape, 'value');
            var seriesName = ecData.get(shape, 'series') != null
                             ? ecData.get(shape, 'series').name
                             : '';
            var font = this.getFont(this.option.island.textStyle);
            var islandOption = this.option.island;
            var islandShape = {
                zlevel: islandOption.zlevel,
                z: islandOption.z,
                style: {
                    x: shape.style.x,
                    y: shape.style.y,
                    r: this.option.island.r,
                    color: shape.style.color || shape.style.strokeColor,
                    text: name + this._valueConnector + value,
                    textFont: font
                },
                draggable: true,
                hoverable: true,
                onmousewheel: this.shapeHandler.onmousewheel,
                _type: 'island'
            };
            if (islandShape.style.color === '#fff') {
                islandShape.style.color = shape.style.strokeColor;
            }
            this.setCalculable(islandShape);
            islandShape.dragEnableTime = 0;
            ecData.pack(
                islandShape,
                {name:seriesName}, -1,
                value, -1,
                name
            );
            islandShape = new CircleShape(islandShape);
            this.shapeList.push(islandShape);
            this.zr.addShape(islandShape);
        },

        del: function (shape) {
            this.zr.delShape(shape.id);
            var newShapeList = [];
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                if (this.shapeList[i].id != shape.id) {
                    newShapeList.push(this.shapeList[i]);
                }
            }
            this.shapeList = newShapeList;
        },

        /**
         * 数据项被拖拽进来， 重载基类方法
         */
        ondrop: function (param, status) {
            if (!this.isDrop || !param.target) {
                // 没有在当前实例上发生拖拽行为则直接返回
                return;
            }
            // 拖拽产生孤岛数据合并
            var target = param.target;      // 拖拽安放目标
            var dragged = param.dragged;    // 当前被拖拽的图形对象

            this._combine(target, dragged);
            this.zr.modShape(target.id);

            status.dragIn = true;

            // 处理完拖拽事件后复位
            this.isDrop = false;

            return;
        },

        /**
         * 数据项被拖拽出去， 重载基类方法
         */
        ondragend: function (param, status) {
            var target = param.target;      // 拖拽安放目标
            if (!this.isDragend) {
                // 拖拽的不是孤岛数据，如果没有图表接受孤岛数据，需要新增孤岛数据
                if (!status.dragIn) {
                    target.style.x = zrEvent.getX(param.event);
                    target.style.y = zrEvent.getY(param.event);
                    this.add(target);
                    status.needRefresh = true;
                }
            }
            else {
                // 拖拽的是孤岛数据，如果有图表接受了孤岛数据，需要删除孤岛数据
                if (status.dragIn) {
                    this.del(target);
                    status.needRefresh = true;
                }
            }

            // 处理完拖拽事件后复位
            this.isDragend = false;

            return;
        }
    };
    
    zrUtil.inherits(Island, ChartBase);
    
    // 图表注册
    require('../chart').define('island', Island);
    
    return Island;
});