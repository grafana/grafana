/**
 * echarts组件：漫游控制器
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var Base = require('./base');
    
    // 图形依赖
    var RectangleShape = require('zrender/shape/Rectangle');
    var SectorShape = require('zrender/shape/Sector');
    var CircleShape = require('zrender/shape/Circle');
    
    var ecConfig = require('../config');
    ecConfig.roamController = {
        zlevel: 0,                  // 一级层叠
        z: 4,                       // 二级层叠
        show: true,
        x: 'left',                 // 水平安放位置，默认为全图左对齐，可选为：
                                   // 'center' ¦ 'left' ¦ 'right'
                                   // ¦ {number}（x坐标，单位px）
        y: 'top',                  // 垂直安放位置，默认为全图顶端，可选为：
                                   // 'top' ¦ 'bottom' ¦ 'center'
                                   // ¦ {number}（y坐标，单位px）
        width: 80,
        height: 120,
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',       // 图例边框颜色
        borderWidth: 0,            // 图例边框线宽，单位px，默认为0（无边框）
        padding: 5,                // 图例内边距，单位px，默认各方向内边距为5，
                                   // 接受数组分别设定上右下左边距，同css
        handleColor: '#6495ed',
        fillerColor: '#fff',
        step: 15,                  // 移动幅度
        mapTypeControl: null
    };

    var zrUtil = require('zrender/tool/util');
    var zrColor = require('zrender/tool/color');
    var zrEvent = require('zrender/tool/event');

    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} option 图表参数
     */
    function RoamController(ecTheme, messageCenter, zr, option, myChart) {
        this.rcOption = {};

        if (!option.roamController || !option.roamController.show) {
            return;
        }
        if (!option.roamController.mapTypeControl) {
            console.error('option.roamController.mapTypeControl has not been defined.');
            return;
        }
        
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        
        this.rcOption = option.roamController;
        
        var self = this;
        this._drictionMouseDown = function(params) {
            return self.__drictionMouseDown(params);
        };
        this._drictionMouseUp = function(params) {
            return self.__drictionMouseUp(params);
        };
        this._drictionMouseMove = function(params) {
            return self.__drictionMouseMove(params);
        };
        this._drictionMouseOut = function(params) {
            return self.__drictionMouseOut(params);
        };
        this._scaleHandler = function(params) {
            return self.__scaleHandler(params);
        };
        this.refresh(option);
    }
    
    RoamController.prototype = {
        type: ecConfig.COMPONENT_TYPE_ROAMCONTROLLER,
        _buildShape: function () {
            if (!this.rcOption.show) {
                return;
            }
            // 元素组的位置参数，通过计算所得x, y, width, height
            this._itemGroupLocation = this._getItemGroupLocation();

            this._buildBackground();
            this._buildItem();

            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.addShape(this.shapeList[i]);
            }
        },

        /**
         * 构建所有漫游控制器元素
         */
        _buildItem: function () {
            this.shapeList.push(this._getDirectionShape('up'));
            this.shapeList.push(this._getDirectionShape('down'));
            this.shapeList.push(this._getDirectionShape('left'));
            this.shapeList.push(this._getDirectionShape('right'));
            this.shapeList.push(this._getScaleShape('scaleUp'));
            this.shapeList.push(this._getScaleShape('scaleDown'));
        },
        
        _getDirectionShape: function(direction) {
            var r = this._itemGroupLocation.r;
            var x = this._itemGroupLocation.x + r;
            var y = this._itemGroupLocation.y + r;
            
            var sectorShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: x,          // 圆心横坐标
                    y: y,          // 圆心纵坐标
                    r: r,          // 圆环外半径
                    startAngle: -45,
                    endAngle: 45,
                    color: this.rcOption.handleColor,
                    text: '>',
                    textX: x + r / 2 + 4,
                    textY: y - 0.5,
                    textAlign: 'center',
                    textBaseline: 'middle',
                    textPosition: 'specific',
                    textColor: this.rcOption.fillerColor,
                    textFont: Math.floor(r / 2) + 'px arial'
                },
                highlightStyle: {
                    color: zrColor.lift(this.rcOption.handleColor, -0.2),
                    brushType: 'fill'
                },
                clickable: true
            };
            switch (direction) {
                case 'up':
                    sectorShape.rotation = [Math.PI / 2, x, y];
                    break;
                case 'left':
                    sectorShape.rotation = [Math.PI, x, y];
                    break;
                case 'down':
                    sectorShape.rotation = [-Math.PI / 2, x, y];
                    break;
            }

            sectorShape = new SectorShape(sectorShape);
            sectorShape._roamType = direction;
            sectorShape.onmousedown = this._drictionMouseDown;
            sectorShape.onmouseup = this._drictionMouseUp;
            sectorShape.onmousemove = this._drictionMouseMove;
            sectorShape.onmouseout = this._drictionMouseOut;
            
            return sectorShape;
        },
        
        _getScaleShape: function(text) {
            var width = this._itemGroupLocation.width;
            var height = this._itemGroupLocation.height - width;
            height = height < 0 ? 20 : height;  // 确保height不为负
            
            var r = Math.min(width / 2 - 5, height) / 2;
            var x = this._itemGroupLocation.x 
                    + (text === 'scaleDown' ? (width - r) : r);
            var y = this._itemGroupLocation.y + this._itemGroupLocation.height - r;

            var scaleShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: x,
                    y: y,
                    r: r,
                    color: this.rcOption.handleColor,
                    text: text === 'scaleDown' ? '-' : '+',
                    textX: x,
                    textY: y - 2,
                    textAlign: 'center',
                    textBaseline: 'middle',
                    textPosition: 'specific',
                    textColor: this.rcOption.fillerColor,
                    textFont: Math.floor(r) + 'px verdana'
                },
                highlightStyle: {
                    color: zrColor.lift(this.rcOption.handleColor, -0.2),
                    brushType: 'fill'
                },
                clickable: true
            };
            
            scaleShape = new CircleShape(scaleShape);
            scaleShape._roamType = text;
            scaleShape.onmousedown = this._scaleHandler;
            
            return scaleShape;
        },
        
        _buildBackground: function () {
            var padding = this.reformCssArray(this.rcOption.padding);

            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable :false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: this.rcOption.borderWidth === 0 ? 'fill' : 'both',
                    color: this.rcOption.backgroundColor,
                    strokeColor: this.rcOption.borderColor,
                    lineWidth: this.rcOption.borderWidth
                }
            }));
        },

        /**
         * 根据选项计算漫游控制器实体的位置坐标
         */
        _getItemGroupLocation: function () {
            var padding = this.reformCssArray(this.rcOption.padding);
            var width = this.rcOption.width;
            var height = this.rcOption.height;
            
            var zrWidth = this.zr.getWidth();
            var zrHeight = this.zr.getHeight();
            var x;
            switch (this.rcOption.x) {
                case 'center' :
                    x = Math.floor((zrWidth - width) / 2);
                    break;
                case 'left' :
                    x = padding[3] + this.rcOption.borderWidth;
                    break;
                case 'right' :
                    x = zrWidth
                        - width
                        - padding[1]
                        - padding[3]
                        - this.rcOption.borderWidth * 2;
                    break;
                default :
                    x = this.parsePercent(this.rcOption.x, zrWidth);
                    break;
            }
            
            var y;
            switch (this.rcOption.y) {
                case 'top' :
                    y = padding[0] + this.rcOption.borderWidth;
                    break;
                case 'bottom' :
                    y = zrHeight
                        - height
                        - padding[0]
                        - padding[2]
                        - this.rcOption.borderWidth * 2;
                    break;
                case 'center' :
                    y = Math.floor((zrHeight - height) / 2);
                    break;
                default :
                    y = this.parsePercent(this.rcOption.y, zrHeight);
                    break;
            }

            return {
                x: x,
                y: y,
                r: width / 2,
                width: width,
                height: height
            };
        },

        __drictionMouseDown: function(params) {
            this.mousedown = true;
            this._drictionHandlerOn(params);
        },
        
        __drictionMouseUp: function(params) {
            this.mousedown = false;
            this._drictionHandlerOff(params);
        },
        
        __drictionMouseMove: function(params) {
            if (this.mousedown) {
                this._drictionHandlerOn(params);
            }
        },
        
        __drictionMouseOut: function(params) {
            this._drictionHandlerOff(params);
        },
        
        _drictionHandlerOn: function(params) {
            this._dispatchEvent(params.event, params.target._roamType);
            clearInterval(this.dircetionTimer);
            var self = this;
            this.dircetionTimer = setInterval(function() {
                self._dispatchEvent(params.event, params.target._roamType);
            }, 100);
            zrEvent.stop(params.event);
        },
        
        _drictionHandlerOff: function(params) {
            clearInterval(this.dircetionTimer);
        },
        
        __scaleHandler: function(params) {
            this._dispatchEvent(params.event, params.target._roamType);
            zrEvent.stop(params.event);
        },
        
        _dispatchEvent: function(event, roamType){
            this.messageCenter.dispatch(
                ecConfig.EVENT.ROAMCONTROLLER,
                event, 
                {
                    roamType: roamType,
                    mapTypeControl: this.rcOption.mapTypeControl,
                    step: this.rcOption.step
                },
                this.myChart
            );
        },
        /**
         * 刷新
         */
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption || this.option;
                this.option.roamController = this.reformOption(this.option.roamController);
                this.rcOption = this.option.roamController;
            }
            this.clear();
            this._buildShape();
        }
    };
    
    
    zrUtil.inherits(RoamController, Base);
    
    require('../component').define('roamController', RoamController);
    
    return RoamController;
});


