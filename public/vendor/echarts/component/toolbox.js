/**
 * echarts组件：工具箱
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var Base = require('./base');
    
    // 图形依赖
    var LineShape = require('zrender/shape/Line');
    var ImageShape = require('zrender/shape/Image');
    var RectangleShape = require('zrender/shape/Rectangle');
    var IconShape = require('../util/shape/Icon');
    
    var ecConfig = require('../config');
    ecConfig.toolbox = {
        zlevel: 0,                  // 一级层叠
        z: 6,                       // 二级层叠
        show: false,
        orient: 'horizontal',      // 布局方式，默认为水平布局，可选为：
                                   // 'horizontal' ¦ 'vertical'
        x: 'right',                // 水平安放位置，默认为全图右对齐，可选为：
                                   // 'center' ¦ 'left' ¦ 'right'
                                   // ¦ {number}（x坐标，单位px）
        y: 'top',                  // 垂直安放位置，默认为全图顶端，可选为：
                                   // 'top' ¦ 'bottom' ¦ 'center'
                                   // ¦ {number}（y坐标，单位px）
        color: ['#1e90ff','#22bb22','#4b0082','#d2691e'],
        disableColor: '#ddd',
        effectiveColor: 'red',
        backgroundColor: 'rgba(0,0,0,0)', // 工具箱背景颜色
        borderColor: '#ccc',       // 工具箱边框颜色
        borderWidth: 0,            // 工具箱边框线宽，单位px，默认为0（无边框）
        padding: 5,                // 工具箱内边距，单位px，默认各方向内边距为5，
                                   // 接受数组分别设定上右下左边距，同css
        itemGap: 10,               // 各个item之间的间隔，单位px，默认为10，
                                   // 横向布局时为水平间隔，纵向布局时为纵向间隔
        itemSize: 16,              // 工具箱图形宽度
        showTitle: true,
        // textStyle: {},
        feature: {
            mark: {
                show: false,
                title: {
                    mark: '辅助线开关',
                    markUndo: '删除辅助线',
                    markClear: '清空辅助线'
                },
                lineStyle: {
                    width: 1,
                    color: '#1e90ff',
                    type: 'dashed'
                }
            },
            dataZoom: {
                show: false,
                title: {
                    dataZoom: '区域缩放',
                    dataZoomReset: '区域缩放后退'
                }
            },
            dataView: {
                show: false,
                title: '数据视图',
                readOnly: false,
                lang: ['数据视图', '关闭', '刷新']
            },
            magicType: {
                show: false,
                title: {
                    line: '折线图切换',
                    bar: '柱形图切换',
                    stack: '堆积',
                    tiled: '平铺',
                    force: '力导向布局图切换',
                    chord: '和弦图切换',
                    pie: '饼图切换',
                    funnel: '漏斗图切换'
                },
                /*
                option: {
                    line: {},
                    bar: {},
                    stack: {},
                    tiled: {},
                    force: {},
                    chord: {},
                    pie: {},
                    funnel: {}
                },
                */
                type: [] // 'line', 'bar', 'stack', 'tiled', 'force', 'chord', 'pie', 'funnel'
            },
            restore: {
                show: false,
                title: '还原'
            },
            saveAsImage: {
                show: false,
                title: '保存为图片',
                type: 'png',
                lang: ['点击保存'] 
            }
        }
    };

    var zrUtil = require('zrender/tool/util');
    var zrConfig = require('zrender/config');
    var zrEvent = require('zrender/tool/event');
    
    var _MAGICTYPE_STACK = 'stack';
    var _MAGICTYPE_TILED = 'tiled';
        
    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {HtmlElement} dom 目标对象
     * @param {ECharts} myChart 当前图表实例
     */
    function Toolbox(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);

        this.dom = myChart.dom;
        
        this._magicType = {};
        this._magicMap = {};
        this._isSilence = false;
        
        this._iconList;
        this._iconShapeMap = {};
        //this._itemGroupLocation;
        this._featureTitle = {};             // 文字
        this._featureIcon = {};              // 图标
        this._featureColor = {};             // 颜色
        this._featureOption = {};
        this._enableColor = 'red';
        this._disableColor = '#ccc';
        // this._markStart;
        // this._marking;
        // this._markShape;
        // this._zoomStart;
        // this._zooming;
        // this._zoomShape;
        // this._zoomQueue;
        // this._dataView;
        this._markShapeList = [];
        var self = this;
        self._onMark = function (param) {
            self.__onMark(param);
        };
        self._onMarkUndo = function (param) {
            self.__onMarkUndo(param);
        };
        self._onMarkClear = function (param) {
            self.__onMarkClear(param);
        };
        self._onDataZoom = function (param) {
            self.__onDataZoom(param);
        };
        self._onDataZoomReset = function (param) {
            self.__onDataZoomReset(param);
        };
        self._onDataView = function (param) {
            self.__onDataView(param);
        };
        self._onRestore = function (param) {
            self.__onRestore(param);
        };
        self._onSaveAsImage = function (param) {
            self.__onSaveAsImage(param);
        };
        self._onMagicType = function (param) {
            self.__onMagicType(param);
        };
        self._onCustomHandler = function (param) {
            self.__onCustomHandler(param);
        };
        self._onmousemove = function (param) {
            return self.__onmousemove(param);
        };

        self._onmousedown = function (param) {
            return self.__onmousedown(param);
        };
        
        self._onmouseup = function (param) {
            return self.__onmouseup(param);
        };
        
        self._onclick = function (param) {
            return self.__onclick(param);
        };
    }

    Toolbox.prototype = {
        type: ecConfig.COMPONENT_TYPE_TOOLBOX,
        _buildShape: function () {
            this._iconList = [];
            var toolboxOption = this.option.toolbox;
            this._enableColor = toolboxOption.effectiveColor;
            this._disableColor = toolboxOption.disableColor;
            var feature = toolboxOption.feature;
            var iconName = [];
            for (var key in feature){
                if (feature[key].show) {
                    switch (key) {
                        case 'mark' :
                            iconName.push({ key: key, name: 'mark' });
                            iconName.push({ key: key, name: 'markUndo' });
                            iconName.push({ key: key, name: 'markClear' });
                            break;
                        case 'magicType' :
                            for (var i = 0, l = feature[key].type.length; i < l; i++) {
                                feature[key].title[feature[key].type[i] + 'Chart']
                                    = feature[key].title[feature[key].type[i]];
                                if (feature[key].option) {
                                    feature[key].option[feature[key].type[i] + 'Chart']
                                        = feature[key].option[feature[key].type[i]];
                                }
                                iconName.push({ key: key, name: feature[key].type[i] + 'Chart' });
                            }
                            break;
                        case 'dataZoom' :
                            iconName.push({ key: key, name: 'dataZoom' });
                            iconName.push({ key: key, name: 'dataZoomReset' });
                            break;
                        case 'saveAsImage' :
                            if (this.canvasSupported) {
                                iconName.push({ key: key, name: 'saveAsImage' });
                            }
                            break;
                        default :
                            iconName.push({ key: key, name: key });
                            break;
                    }
                }
            }
            if (iconName.length > 0) {
                var name;
                var key;
                for (var i = 0, l = iconName.length; i < l; i++) {
                    name = iconName[i].name;
                    key = iconName[i].key;
                    this._iconList.push(name);
                    this._featureTitle[name] = feature[key].title[name] || feature[key].title;
                    if (feature[key].icon) {
                        this._featureIcon[name] = feature[key].icon[name] || feature[key].icon;
                    }
                    if (feature[key].color) {
                        this._featureColor[name] = feature[key].color[name] || feature[key].color;
                    }
                    if (feature[key].option) {
                        this._featureOption[name] = feature[key].option[name] 
                                                    || feature[key].option;
                    }
                }
                this._itemGroupLocation = this._getItemGroupLocation();

                this._buildBackground();
                this._buildItem();

                for (var i = 0, l = this.shapeList.length; i < l; i++) {
                    this.zr.addShape(this.shapeList[i]);
                }
                if (this._iconShapeMap['mark']) {
                    this._iconDisable(this._iconShapeMap['markUndo']);
                    this._iconDisable(this._iconShapeMap['markClear']);
                }
                if (this._iconShapeMap['dataZoomReset'] && this._zoomQueue.length === 0) {
                    this._iconDisable(this._iconShapeMap['dataZoomReset']);
                }
            }
        },

        /**
         * 构建所有图例元素
         */
        _buildItem: function () {
            var toolboxOption = this.option.toolbox;
            var iconLength = this._iconList.length;
            var lastX = this._itemGroupLocation.x;
            var lastY = this._itemGroupLocation.y;
            var itemSize = toolboxOption.itemSize;
            var itemGap = toolboxOption.itemGap;
            var itemShape;

            var color = toolboxOption.color instanceof Array
                        ? toolboxOption.color : [toolboxOption.color];
            
            var textFont = this.getFont(toolboxOption.textStyle);
            var textPosition;
            var textAlign;
            var textBaseline;
            if (toolboxOption.orient === 'horizontal') {
                textPosition = this._itemGroupLocation.y / this.zr.getHeight() < 0.5
                               ? 'bottom' : 'top';
                textAlign = this._itemGroupLocation.x / this.zr.getWidth() < 0.5
                            ? 'left' : 'right';
                textBaseline = this._itemGroupLocation.y / this.zr.getHeight() < 0.5
                               ? 'top' : 'bottom';
            }
            else {
                textPosition = this._itemGroupLocation.x / this.zr.getWidth() < 0.5
                               ? 'right' : 'left';
            }
            
           this._iconShapeMap = {};
           var self = this;

            for (var i = 0; i < iconLength; i++) {
                // 图形
                itemShape = {
                    type: 'icon',
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    style: {
                        x: lastX,
                        y: lastY,
                        width: itemSize,
                        height: itemSize,
                        iconType: this._iconList[i],
                        lineWidth: 1,
                        strokeColor: this._featureColor[this._iconList[i]] 
                                     || color[i % color.length],
                        brushType: 'stroke'
                    },
                    highlightStyle: {
                        lineWidth: 1,
                        text: toolboxOption.showTitle 
                              ? this._featureTitle[this._iconList[i]]
                              : undefined,
                        textFont: textFont,
                        textPosition: textPosition,
                        strokeColor: this._featureColor[this._iconList[i]] 
                                     || color[i % color.length]
                    },
                    hoverable: true,
                    clickable: true
                };
                
                if (this._featureIcon[this._iconList[i]]) {
                    itemShape.style.image = this._featureIcon[this._iconList[i]].replace(
                        new RegExp('^image:\\/\\/'), ''
                    );
                    itemShape.style.opacity = 0.8;
                    itemShape.highlightStyle.opacity = 1;
                    itemShape.type = 'image';
                }
                
                if (toolboxOption.orient === 'horizontal') {
                    // 修正左对齐第一个或右对齐最后一个
                    if (i === 0 && textAlign === 'left') {
                        itemShape.highlightStyle.textPosition = 'specific';
                        itemShape.highlightStyle.textAlign = textAlign;
                        itemShape.highlightStyle.textBaseline = textBaseline;
                        itemShape.highlightStyle.textX = lastX;
                        itemShape.highlightStyle.textY = textBaseline === 'top' 
                                                     ? lastY + itemSize + 10
                                                     : lastY - 10;
                    }
                    if (i === iconLength - 1 && textAlign === 'right') {
                        itemShape.highlightStyle.textPosition = 'specific';
                        itemShape.highlightStyle.textAlign = textAlign;
                        itemShape.highlightStyle.textBaseline = textBaseline;
                        itemShape.highlightStyle.textX = lastX + itemSize;
                        itemShape.highlightStyle.textY = textBaseline === 'top' 
                                                         ? lastY + itemSize + 10
                                                         : lastY - 10;
                    }
                }
                
                switch(this._iconList[i]) {
                    case 'mark':
                        itemShape.onclick = self._onMark;
                        break;
                    case 'markUndo':
                        itemShape.onclick = self._onMarkUndo;
                        break;
                    case 'markClear':
                        itemShape.onclick = self._onMarkClear;
                        break;
                    case 'dataZoom':
                        itemShape.onclick = self._onDataZoom;
                        break;
                    case 'dataZoomReset':
                        itemShape.onclick = self._onDataZoomReset;
                        break;
                    case 'dataView' :
                        if (!this._dataView) {
                            var DataView = require('./dataView');
                            this._dataView = new DataView(
                                this.ecTheme, this.messageCenter, this.zr, this.option, this.myChart
                            );
                        }
                        itemShape.onclick = self._onDataView;
                        break;
                    case 'restore':
                        itemShape.onclick = self._onRestore;
                        break;
                    case 'saveAsImage':
                        itemShape.onclick = self._onSaveAsImage;
                        break;
                    default:
                        if (this._iconList[i].match('Chart')) {
                            itemShape._name = this._iconList[i].replace('Chart', '');
                            itemShape.onclick = self._onMagicType;
                        }
                        else {
                            itemShape.onclick = self._onCustomHandler;
                        }
                        break;
                }

                if (itemShape.type === 'icon') {
                    itemShape = new IconShape(itemShape);
                }
                else if (itemShape.type === 'image') {
                    itemShape = new ImageShape(itemShape);
                }
                this.shapeList.push(itemShape);
                this._iconShapeMap[this._iconList[i]] = itemShape;

                if (toolboxOption.orient === 'horizontal') {
                    lastX += itemSize + itemGap;
                }
                else {
                    lastY += itemSize + itemGap;
                }
            }
        },

        _buildBackground: function () {
            var toolboxOption = this.option.toolbox;
            var padding = this.reformCssArray(this.option.toolbox.padding);

            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable :false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: toolboxOption.borderWidth === 0 ? 'fill' : 'both',
                    color: toolboxOption.backgroundColor,
                    strokeColor: toolboxOption.borderColor,
                    lineWidth: toolboxOption.borderWidth
                }
            }));
        },

        /**
         * 根据选项计算图例实体的位置坐标
         */
        _getItemGroupLocation: function () {
            var toolboxOption = this.option.toolbox;
            var padding = this.reformCssArray(this.option.toolbox.padding);
            var iconLength = this._iconList.length;
            var itemGap = toolboxOption.itemGap;
            var itemSize = toolboxOption.itemSize;
            var totalWidth = 0;
            var totalHeight = 0;

            if (toolboxOption.orient === 'horizontal') {
                // 水平布局，计算总宽度，别忘减去最后一个的itemGap
                totalWidth = (itemSize + itemGap) * iconLength - itemGap;
                totalHeight = itemSize;
            }
            else {
                // 垂直布局，计算总高度
                totalHeight = (itemSize + itemGap) * iconLength - itemGap;
                totalWidth = itemSize;
            }

            var x;
            var zrWidth = this.zr.getWidth();
            switch (toolboxOption.x) {
                case 'center' :
                    x = Math.floor((zrWidth - totalWidth) / 2);
                    break;
                case 'left' :
                    x = padding[3] + toolboxOption.borderWidth;
                    break;
                case 'right' :
                    x = zrWidth
                        - totalWidth
                        - padding[1]
                        - toolboxOption.borderWidth;
                    break;
                default :
                    x = toolboxOption.x - 0;
                    x = isNaN(x) ? 0 : x;
                    break;
            }

            var y;
            var zrHeight = this.zr.getHeight();
            switch (toolboxOption.y) {
                case 'top' :
                    y = padding[0] + toolboxOption.borderWidth;
                    break;
                case 'bottom' :
                    y = zrHeight
                        - totalHeight
                        - padding[2]
                        - toolboxOption.borderWidth;
                    break;
                case 'center' :
                    y = Math.floor((zrHeight - totalHeight) / 2);
                    break;
                default :
                    y = toolboxOption.y - 0;
                    y = isNaN(y) ? 0 : y;
                    break;
            }

            return {
                x: x,
                y: y,
                width: totalWidth,
                height: totalHeight
            };
        },

        __onmousemove: function (param) {
            if (this._marking) {
                this._markShape.style.xEnd = zrEvent.getX(param.event);
                this._markShape.style.yEnd = zrEvent.getY(param.event);
                this.zr.addHoverShape(this._markShape);
            }
            if (this._zooming) {
                this._zoomShape.style.width = 
                    zrEvent.getX(param.event) - this._zoomShape.style.x;
                this._zoomShape.style.height = 
                    zrEvent.getY(param.event) - this._zoomShape.style.y;
                this.zr.addHoverShape(this._zoomShape);
                this.dom.style.cursor = 'crosshair';
                zrEvent.stop(param.event);
            }
            if (this._zoomStart
                && (this.dom.style.cursor != 'pointer' && this.dom.style.cursor != 'move')
            ) {
                this.dom.style.cursor = 'crosshair';
            }
        },

        __onmousedown: function (param) {
            if (param.target) {
                return;
            }
            this._zooming = true;
            var x = zrEvent.getX(param.event);
            var y = zrEvent.getY(param.event);
            var zoomOption = this.option.dataZoom || {};
            this._zoomShape = new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: x,
                    y: y,
                    width: 1,
                    height: 1,
                    brushType: 'both'
                },
                highlightStyle: {
                    lineWidth: 2,
                    color: zoomOption.fillerColor 
                           || ecConfig.dataZoom.fillerColor,
                    strokeColor: zoomOption.handleColor 
                                  || ecConfig.dataZoom.handleColor,
                    brushType: 'both'
                }
            });
            this.zr.addHoverShape(this._zoomShape);
            return true; // 阻塞全局事件
        },
        
        __onmouseup: function (/*param*/) {
            if (!this._zoomShape 
                || Math.abs(this._zoomShape.style.width) < 10 
                || Math.abs(this._zoomShape.style.height) < 10
            ) {
                this._zooming = false;
                return true;
            }
            if (this._zooming && this.component.dataZoom) {
                this._zooming = false;
                
                var zoom = this.component.dataZoom.rectZoom(this._zoomShape.style);
                if (zoom) {
                    this._zoomQueue.push({
                        start: zoom.start,
                        end: zoom.end,
                        start2: zoom.start2,
                        end2: zoom.end2
                    });
                    this._iconEnable(this._iconShapeMap['dataZoomReset']);
                    this.zr.refreshNextFrame();
                }
            }
            return true; // 阻塞全局事件
        },
        
        __onclick: function (param) {
            if (param.target) {
                return;
            }
            if (this._marking) {
                this._marking = false;
                this._markShapeList.push(this._markShape);
                this._iconEnable(this._iconShapeMap['markUndo']);
                this._iconEnable(this._iconShapeMap['markClear']);
                this.zr.addShape(this._markShape);
                this.zr.refreshNextFrame();
            } 
            else if (this._markStart) {
                this._marking = true;
                var x = zrEvent.getX(param.event);
                var y = zrEvent.getY(param.event);
                this._markShape = new LineShape({
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    style: {
                        xStart: x,
                        yStart: y,
                        xEnd: x,
                        yEnd: y,
                        lineWidth: this.query(
                                       this.option,
                                       'toolbox.feature.mark.lineStyle.width'
                                   ),
                        strokeColor: this.query(
                                         this.option,
                                         'toolbox.feature.mark.lineStyle.color'
                                     ),
                        lineType: this.query(
                                      this.option,
                                      'toolbox.feature.mark.lineStyle.type'
                                  )
                    }
                });
                this.zr.addHoverShape(this._markShape);
            }
        },
        
        __onMark: function (param) {
            var target = param.target;
            if (this._marking || this._markStart) {
                // 取消
                this._resetMark();
                this.zr.refreshNextFrame();
            }
            else {
                // 启用Mark
                this._resetZoom();   // mark与dataZoom互斥
                
                this.zr.modShape(target.id, {style: {strokeColor: this._enableColor}});
                this.zr.refreshNextFrame();
                this._markStart = true;
                var self = this;
                setTimeout(function (){
                    self.zr
                    && self.zr.on(zrConfig.EVENT.CLICK, self._onclick)
                    && self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                }, 10);
            }
            return true; // 阻塞全局事件
        },
        
        __onMarkUndo: function () {
            if (this._marking) {
                this._marking = false;
            } else {
                var len = this._markShapeList.length;
                if (len >= 1) {
                    var target = this._markShapeList[len - 1];
                    this.zr.delShape(target.id);
                    this.zr.refreshNextFrame();
                    this._markShapeList.pop();
                    if (len === 1) {
                        this._iconDisable(this._iconShapeMap['markUndo']);
                        this._iconDisable(this._iconShapeMap['markClear']);
                    }
                }
            }
            return true;
        },

        __onMarkClear: function () {
            if (this._marking) {
                this._marking = false;
            }
            var len = this._markShapeList.length;
            if (len > 0) {
                while(len--) {
                    this.zr.delShape(this._markShapeList.pop().id);
                }
                this._iconDisable(this._iconShapeMap['markUndo']);
                this._iconDisable(this._iconShapeMap['markClear']);
                this.zr.refreshNextFrame();
            }
            return true;
        },
        
        __onDataZoom: function (param) {
            var target = param.target;
            if (this._zooming || this._zoomStart) {
                // 取消
                this._resetZoom();
                this.zr.refreshNextFrame();
                this.dom.style.cursor = 'default';
            }
            else {
                // 启用Zoom
                this._resetMark();   // mark与dataZoom互斥
                
                this.zr.modShape(target.id, {style: {strokeColor: this._enableColor}});
                this.zr.refreshNextFrame();
                this._zoomStart = true;
                var self = this;
                setTimeout(function (){
                    self.zr
                    && self.zr.on(zrConfig.EVENT.MOUSEDOWN, self._onmousedown)
                    && self.zr.on(zrConfig.EVENT.MOUSEUP, self._onmouseup)
                    && self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                }, 10);
                
                this.dom.style.cursor = 'crosshair';
            }
            return true; // 阻塞全局事件
        },
        
        __onDataZoomReset: function () {
            if (this._zooming) {
                this._zooming = false;
            }
            this._zoomQueue.pop();
            //console.log(this._zoomQueue)
            if (this._zoomQueue.length > 0) {
                this.component.dataZoom.absoluteZoom(
                    this._zoomQueue[this._zoomQueue.length - 1]
                );
            }
            else {
                this.component.dataZoom.rectZoom();
                this._iconDisable(this._iconShapeMap['dataZoomReset']);
                this.zr.refreshNextFrame();
            }
            
            return true;
        },

        _resetMark: function () {
            this._marking = false;
            if (this._markStart) {
                this._markStart = false;
                if (this._iconShapeMap['mark']) {
                    // 还原图标为未生效状态
                    this.zr.modShape(
                        this._iconShapeMap['mark'].id,
                        {
                            style: {
                                strokeColor: this._iconShapeMap['mark']
                                                 .highlightStyle
                                                 .strokeColor
                            }
                         }
                    );
                }
                
                this.zr.un(zrConfig.EVENT.CLICK, this._onclick);
                this.zr.un(zrConfig.EVENT.MOUSEMOVE, this._onmousemove);
            }
        },
        
        _resetZoom: function () {
            this._zooming = false;
            if (this._zoomStart) {
                this._zoomStart = false;
                if (this._iconShapeMap['dataZoom']) {
                    // 还原图标为未生效状态
                    this.zr.modShape(
                        this._iconShapeMap['dataZoom'].id,
                        {
                            style: {
                                strokeColor: this._iconShapeMap['dataZoom']
                                                 .highlightStyle
                                                 .strokeColor
                            }
                         }
                    );
                }
                
                this.zr.un(zrConfig.EVENT.MOUSEDOWN, this._onmousedown);
                this.zr.un(zrConfig.EVENT.MOUSEUP, this._onmouseup);
                this.zr.un(zrConfig.EVENT.MOUSEMOVE, this._onmousemove);
            }
        },

        _iconDisable: function (target) {
            if (target.type != 'image') {
                this.zr.modShape(target.id, {
                    hoverable: false,
                    clickable: false,
                    style: {
                        strokeColor: this._disableColor
                    }
                });
            }
            else {
                this.zr.modShape(target.id, {
                    hoverable: false,
                    clickable: false,
                    style: {
                        opacity: 0.3
                    }
                });
            }
        },

        _iconEnable: function (target) {
            if (target.type != 'image') {
                this.zr.modShape(target.id, {
                    hoverable: true,
                    clickable: true,
                    style: {
                        strokeColor: target.highlightStyle.strokeColor
                    }
                });
            }
            else {
                this.zr.modShape(target.id, {
                    hoverable: true,
                    clickable: true,
                    style: {
                        opacity: 0.8
                    }
                });
            }
        },

        __onDataView: function () {
            this._dataView.show(this.option);
            return true;
        },

        __onRestore: function (){
            this._resetMark();
            this._resetZoom();
            this.messageCenter.dispatch(ecConfig.EVENT.RESTORE, null, null, this.myChart);
            return true;
        },
        
        __onSaveAsImage: function () {
            var saveOption = this.option.toolbox.feature.saveAsImage;
            var imgType = saveOption.type || 'png';
            if (imgType != 'png' && imgType != 'jpeg') {
                imgType = 'png';
            }
            
            var image;
            if (!this.myChart.isConnected()) {
                image = this.zr.toDataURL(
                    'image/' + imgType,
                    this.option.backgroundColor 
                    && this.option.backgroundColor.replace(' ','') === 'rgba(0,0,0,0)'
                        ? '#fff' : this.option.backgroundColor
                );
            }
            else {
                image = this.myChart.getConnectedDataURL(imgType);
            }
             
            var downloadDiv = document.createElement('div');
            downloadDiv.id = '__echarts_download_wrap__';
            downloadDiv.style.cssText = 'position:fixed;'
                + 'z-index:99999;'
                + 'display:block;'
                + 'top:0;left:0;'
                + 'background-color:rgba(33,33,33,0.5);'
                + 'text-align:center;'
                + 'width:100%;'
                + 'height:100%;'
                + 'line-height:' 
                + document.documentElement.clientHeight + 'px;';
                
            var downloadLink = document.createElement('a');
            //downloadLink.onclick = _saveImageForIE;
            downloadLink.href = image;
            downloadLink.setAttribute(
                'download',
                (saveOption.name 
                 ? saveOption.name 
                 : (this.option.title && (this.option.title.text || this.option.title.subtext))
                   ? (this.option.title.text || this.option.title.subtext)
                   : 'ECharts')
                + '.' + imgType 
            );
            downloadLink.innerHTML = '<img style="vertical-align:middle" src="' + image 
                + '" title="'
                + ((!!window.ActiveXObject || 'ActiveXObject' in window)
                  ? '右键->图片另存为'
                  : (saveOption.lang ? saveOption.lang[0] : '点击保存'))
                + '"/>';
            
            downloadDiv.appendChild(downloadLink);
            document.body.appendChild(downloadDiv);
            downloadLink = null;
            downloadDiv = null;
            
            setTimeout(function (){
                var _d = document.getElementById('__echarts_download_wrap__');
                if (_d) {
                    _d.onclick = function () {
                        var d = document.getElementById(
                            '__echarts_download_wrap__'
                        );
                        d.onclick = null;
                        d.innerHTML = '';
                        document.body.removeChild(d);
                        d = null;
                    };
                    _d = null;
                }
            }, 500);
            
            /*
            function _saveImageForIE() {
                window.win = window.open(image);
                win.document.execCommand("SaveAs");
                win.close()
            }
            */
            return;
        },

        __onMagicType: function (param) {
            this._resetMark();
            var itemName = param.target._name;
            if (!this._magicType[itemName]) {
                // 启用
                this._magicType[itemName] = true;
                // 折柱互斥
                if (itemName === ecConfig.CHART_TYPE_LINE) {
                    this._magicType[ecConfig.CHART_TYPE_BAR] = false;
                }
                else if (itemName === ecConfig.CHART_TYPE_BAR) {
                    this._magicType[ecConfig.CHART_TYPE_LINE] = false;
                }
                // 饼图漏斗互斥
                if (itemName === ecConfig.CHART_TYPE_PIE) {
                    this._magicType[ecConfig.CHART_TYPE_FUNNEL] = false;
                }
                else if (itemName === ecConfig.CHART_TYPE_FUNNEL) {
                    this._magicType[ecConfig.CHART_TYPE_PIE] = false;
                }
                // 力导和弦互斥
                if (itemName === ecConfig.CHART_TYPE_FORCE) {
                    this._magicType[ecConfig.CHART_TYPE_CHORD] = false;
                }
                else if (itemName === ecConfig.CHART_TYPE_CHORD) {
                    this._magicType[ecConfig.CHART_TYPE_FORCE] = false;
                }
                // 堆积平铺互斥
                if (itemName === _MAGICTYPE_STACK) {
                    this._magicType[_MAGICTYPE_TILED] = false;
                }
                else if (itemName === _MAGICTYPE_TILED) {
                    this._magicType[_MAGICTYPE_STACK] = false;
                }
                this.messageCenter.dispatch(
                    ecConfig.EVENT.MAGIC_TYPE_CHANGED,
                    param.event,
                    { magicType: this._magicType },
                    this.myChart
                );
            }
            
            return true;
        },
        
        setMagicType: function (magicType) {
            this._resetMark();
            this._magicType = magicType;
            
            !this._isSilence && this.messageCenter.dispatch(
                ecConfig.EVENT.MAGIC_TYPE_CHANGED,
                null,
                { magicType: this._magicType },
                this.myChart
            );
        },
        
        // 用户自定义扩展toolbox方法
        __onCustomHandler: function (param) {
            var target = param.target.style.iconType;
            var featureHandler = this.option.toolbox.feature[target].onclick;
            if (typeof featureHandler === 'function') {
                featureHandler.call(this, this.option);
            }
        },

        // 重置备份还原状态等
        reset: function (newOption, isRestore) {
            isRestore && this.clear();
            
            if (this.query(newOption, 'toolbox.show')
                && this.query(newOption, 'toolbox.feature.magicType.show')
            ) {
                var magicType = newOption.toolbox.feature.magicType.type;
                var len = magicType.length;
                this._magicMap = {};     // 标识可控类型
                while (len--) {
                    this._magicMap[magicType[len]] = true;
                }

                len = newOption.series.length;
                var oriType;        // 备份还原可控类型
                var axis;
                while (len--) {
                    oriType = newOption.series[len].type;
                    if (this._magicMap[oriType]) {
                        axis = newOption.xAxis instanceof Array
                               ? newOption.xAxis[newOption.series[len].xAxisIndex || 0]
                               : newOption.xAxis;
                        if (axis && (axis.type || 'category') === 'category') {
                            axis.__boundaryGap = axis.boundaryGap != null
                                                 ? axis.boundaryGap : true;
                        }
                        axis = newOption.yAxis instanceof Array
                               ? newOption.yAxis[newOption.series[len].yAxisIndex || 0]
                               : newOption.yAxis;
                        if (axis && axis.type === 'category') {
                            axis.__boundaryGap = axis.boundaryGap != null
                                                 ? axis.boundaryGap : true;
                        }
                        newOption.series[len].__type = oriType;
                        // 避免不同类型图表类型的样式污染
                        newOption.series[len].__itemStyle = zrUtil.clone(
                            newOption.series[len].itemStyle || {}
                        );
                    }
                    
                    if (this._magicMap[_MAGICTYPE_STACK] || this._magicMap[_MAGICTYPE_TILED]) {
                        newOption.series[len].__stack = newOption.series[len].stack;
                    }
                }
            }
            
            this._magicType = isRestore ? {} : (this._magicType || {});
            for (var itemName in this._magicType) {
                if (this._magicType[itemName]) {
                    this.option = newOption;
                    this.getMagicOption();
                    break;
                }
            }
            
            // 框选缩放
            var zoomOption = newOption.dataZoom;
            if (zoomOption && zoomOption.show) {
                var start = zoomOption.start != null
                            && zoomOption.start >= 0
                            && zoomOption.start <= 100
                            ? zoomOption.start : 0;
                var end = zoomOption.end != null
                          && zoomOption.end >= 0
                          && zoomOption.end <= 100
                          ? zoomOption.end : 100;
                if (start > end) {
                    // 大小颠倒自动翻转
                    start = start + end;
                    end = start - end;
                    start = start - end;
                }
                this._zoomQueue = [{
                    start: start,
                    end: end,
                    start2: 0,
                    end2: 100
                }];
            }
            else {
                this._zoomQueue = [];
            }
        },
        
        getMagicOption: function (){
            var axis;
            var chartType;
            if (this._magicType[ecConfig.CHART_TYPE_LINE] 
                || this._magicType[ecConfig.CHART_TYPE_BAR]
            ) {
                // 图表类型有折柱切换
                var boundaryGap = this._magicType[ecConfig.CHART_TYPE_LINE] ? false : true;
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    chartType = this.option.series[i].type;
                    if (chartType == ecConfig.CHART_TYPE_LINE
                        || chartType == ecConfig.CHART_TYPE_BAR
                    ) {
                        axis = this.option.xAxis instanceof Array
                               ? this.option.xAxis[this.option.series[i].xAxisIndex || 0]
                               : this.option.xAxis;
                        if (axis && (axis.type || 'category') === 'category') {
                            axis.boundaryGap = boundaryGap ? true : axis.__boundaryGap;
                        }
                        axis = this.option.yAxis instanceof Array
                               ? this.option.yAxis[this.option.series[i].yAxisIndex || 0]
                               : this.option.yAxis;
                        if (axis && axis.type === 'category') {
                            axis.boundaryGap = boundaryGap ? true : axis.__boundaryGap;
                        }
                    }
                }
                
                this._defaultMagic(ecConfig.CHART_TYPE_LINE, ecConfig.CHART_TYPE_BAR);
            }
            this._defaultMagic(ecConfig.CHART_TYPE_CHORD, ecConfig.CHART_TYPE_FORCE);
            this._defaultMagic(ecConfig.CHART_TYPE_PIE, ecConfig.CHART_TYPE_FUNNEL);
            
            if (this._magicType[_MAGICTYPE_STACK] || this._magicType[_MAGICTYPE_TILED]) {
                // 有堆积平铺切换
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    if (this._magicType[_MAGICTYPE_STACK]) {
                        // 启用堆积
                        this.option.series[i].stack = '_ECHARTS_STACK_KENER_2014_';
                        chartType = _MAGICTYPE_STACK;
                    }
                    else if (this._magicType[_MAGICTYPE_TILED]) {
                        // 启用平铺
                        this.option.series[i].stack = null;
                        chartType = _MAGICTYPE_TILED;
                    }
                    if (this._featureOption[chartType + 'Chart']) {
                        zrUtil.merge(
                            this.option.series[i],
                            this._featureOption[chartType + 'Chart'] || {},
                            true
                        );
                    }
                }
            }
            return this.option;
        },
        
        _defaultMagic : function(cType1, cType2) {
            if (this._magicType[cType1] || this._magicType[cType2]) {
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    var chartType = this.option.series[i].type;
                    if (chartType == cType1 || chartType == cType2) {
                        this.option.series[i].type = this._magicType[cType1] ? cType1 : cType2;
                        // 避免不同类型图表类型的样式污染
                        this.option.series[i].itemStyle = zrUtil.clone(
                            this.option.series[i].__itemStyle
                        );
                        chartType = this.option.series[i].type;
                        if (this._featureOption[chartType + 'Chart']) {
                            zrUtil.merge(
                                this.option.series[i],
                                this._featureOption[chartType + 'Chart'] || {},
                                true
                            );
                        }
                    }
                }
            }
        },

        silence: function (s) {
            this._isSilence = s;
        },
        
        resize: function () {
            this._resetMark();
            this.clear();
            if (this.option && this.option.toolbox && this.option.toolbox.show) {
               this._buildShape();
            }
            if (this._dataView) {
                this._dataView.resize();
            }
        },

        hideDataView: function () {
            if (this._dataView) {
                this._dataView.hide();
            }
        },
        
        clear: function(notMark) {
            if (this.zr) {
                this.zr.delShape(this.shapeList);
                this.shapeList = [];
                
                if (!notMark) {
                    this.zr.delShape(this._markShapeList);
                    this._markShapeList = [];
                }
            }
        },
        
        /**
         * 释放后实例不可用
         */
        onbeforDispose: function () {
            if (this._dataView) {
                this._dataView.dispose();
                this._dataView = null;
            }
            this._markShapeList = null;
        },
        
        /**
         * 刷新
         */
        refresh: function (newOption) {
            if (newOption) {
                this._resetMark();
                this._resetZoom();
                
                newOption.toolbox = this.reformOption(newOption.toolbox);
                this.option = newOption;
                
                this.clear(true);
    
                if (newOption.toolbox.show) {
                    this._buildShape();
                }
    
                this.hideDataView();
            }
        }
    };
    
    zrUtil.inherits(Toolbox, Base);
    
    require('../component').define('toolbox', Toolbox);
    
    return Toolbox;
});
