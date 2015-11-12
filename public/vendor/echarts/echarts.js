/*!
 * ECharts, a javascript interactive chart library.
 *
 * Copyright (c) 2015, Baidu Inc.
 * All rights reserved.
 *
 * LICENSE
 * https://github.com/ecomfe/echarts/blob/master/LICENSE.txt
 */

/**
 * echarts
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var ecConfig = require('vendor/echarts/config');
    var zrUtil = require('zrender/tool/util');
    var zrEvent = require('zrender/tool/event');

    var self = {};

    var _canvasSupported = require('zrender/tool/env').canvasSupported;
    var _idBase = new Date() - 0;
    var _instances = {};    // ECharts实例map索引
    var DOM_ATTRIBUTE_KEY = '_echarts_instance_';

    self.version = '2.2.7';
    self.dependencies = {
        zrender: '2.1.1'
    };
    /**
     * 入口方法
     */
    self.init = function (dom, theme) {
        var zrender = require('zrender');
        if ((zrender.version.replace('.', '') - 0) < (self.dependencies.zrender.replace('.', '') - 0)) {
            console.error(
                'ZRender ' + zrender.version
                + ' is too old for ECharts ' + self.version
                + '. Current version need ZRender '
                + self.dependencies.zrender + '+'
            );
        }

        dom = dom instanceof Array ? dom[0] : dom;

        // dom与echarts实例映射索引
        var key = dom.getAttribute(DOM_ATTRIBUTE_KEY);
        if (!key) {
            key = _idBase++;
            dom.setAttribute(DOM_ATTRIBUTE_KEY, key);
        }

        if (_instances[key]) {
            // 同一个dom上多次init，自动释放已有实例
            _instances[key].dispose();
        }
        _instances[key] = new Echarts(dom);
        _instances[key].id = key;
        _instances[key].canvasSupported = _canvasSupported;
        _instances[key].setTheme(theme);

        return _instances[key];
    };

    /**
     * 通过id获得ECharts实例，id可在实例化后读取
     */
    self.getInstanceById = function (key) {
        return _instances[key];
    };

    /**
     * 消息中心
     */
    function MessageCenter() {
        zrEvent.Dispatcher.call(this);
    }
    zrUtil.merge(MessageCenter.prototype, zrEvent.Dispatcher.prototype, true);

    /**
     * 基于zrender实现Echarts接口层
     * @param {HtmlElement} dom 必要
     */
    function Echarts(dom) {
        // Fxxk IE11 for breaking initialization without a warrant;
        // Just set something to let it be!
        // by kener 2015-01-09
        dom.innerHTML = '';
        this._themeConfig = {}; // zrUtil.clone(ecConfig);

        this.dom = dom;
        // this._zr;
        // this._option;                    // curOption clone
        // this._optionRestore;             // for restore;
        // this._island;
        // this._toolbox;
        // this._timeline;
        // this._refreshInside;             // 内部刷新标志位

        this._connected = false;
        this._status = {                    // 用于图表间通信
            dragIn: false,
            dragOut: false,
            needRefresh: false
        };
        this._curEventType = false;         // 破循环信号灯
        this._chartList = [];               // 图表实例

        this._messageCenter = new MessageCenter();

        this._messageCenterOutSide = new MessageCenter();    // Echarts层的外部消息中心，做Echarts层的消息转发

        // resize方法经常被绑定到window.resize上，闭包一个this
        this.resize = this.resize();

        // 初始化::构造函数
        this._init();
    }

    /**
     * ZRender EVENT
     *
     * @inner
     * @const
     * @type {Object}
     */
    var ZR_EVENT = require('zrender/config').EVENT;

    /**
     * 要绑定监听的zrender事件列表
     *
     * @const
     * @inner
     * @type {Array}
     */
    var ZR_EVENT_LISTENS = [
        'CLICK', 'DBLCLICK', 'MOUSEOVER', 'MOUSEOUT',
        'DRAGSTART', 'DRAGEND', 'DRAGENTER', 'DRAGOVER', 'DRAGLEAVE', 'DROP'
    ];

    /**
     * 对echarts的实例中的chartList属性成员，逐个进行方法调用，遍历顺序为逆序
     * 由于在事件触发的默认行为处理中，多次用到相同逻辑，所以抽象了该方法
     * 由于所有的调用场景里，最多只有两个参数，基于性能和体积考虑，这里就不使用call或者apply了
     *
     * @inner
     * @param {ECharts} ecInstance ECharts实例
     * @param {string} methodName 要调用的方法名
     * @param {*} arg0 调用参数1
     * @param {*} arg1 调用参数2
     * @param {*} arg2 调用参数3
     */
    function callChartListMethodReverse(ecInstance, methodName, arg0, arg1, arg2) {
        var chartList = ecInstance._chartList;
        var len = chartList.length;

        while (len--) {
            var chart = chartList[len];
            if (typeof chart[methodName] === 'function') {
                chart[methodName](arg0, arg1, arg2);
            }
        }
    }

    Echarts.prototype = {
        /**
         * 初始化::构造函数
         */
        _init: function () {
            var self = this;
            var _zr = require('zrender').init(this.dom);
            this._zr = _zr;

            // wrap: n,e,d,t for name event data this
            this._messageCenter.dispatch = function(type, event, eventPackage, that) {
                eventPackage = eventPackage || {};
                eventPackage.type = type;
                eventPackage.event = event;

                self._messageCenter.dispatchWithContext(type, eventPackage, that);
                self._messageCenterOutSide.dispatchWithContext(type, eventPackage, that);

                // 如下注掉的代码，@see: https://github.com/ecomfe/echarts-discuss/issues/3
                // if (type != 'HOVER' && type != 'MOUSEOUT') {    // 频繁事件直接抛出
                //     setTimeout(function(){
                //         self._messageCenterOutSide.dispatchWithContext(
                //             type, eventPackage, that
                //         );
                //     },50);
                // }
                // else {
                //     self._messageCenterOutSide.dispatchWithContext(
                //         type, eventPackage, that
                //     );
                // }
            };

            this._onevent = function(param){
                return self.__onevent(param);
            };
            for (var e in ecConfig.EVENT) {
                if (e != 'CLICK' && e != 'DBLCLICK'
                    && e != 'HOVER' && e != 'MOUSEOUT' && e != 'MAP_ROAM'
                ) {
                    this._messageCenter.bind(ecConfig.EVENT[e], this._onevent, this);
                }
            }


            var eventBehaviors = {};
            this._onzrevent = function (param) {
                return self[eventBehaviors[ param.type ]](param);
            };

            // 挂载关心的事件
            for (var i = 0, len = ZR_EVENT_LISTENS.length; i < len; i++) {
                var eventName = ZR_EVENT_LISTENS[i];
                var eventValue = ZR_EVENT[eventName];
                eventBehaviors[eventValue] = '_on' + eventName.toLowerCase();
                _zr.on(eventValue, this._onzrevent);
            }

            this.chart = {};            // 图表索引
            this.component = {};        // 组件索引

            // 内置图表
            // 孤岛
            var Island = require('vendor/echarts/chart/island');
            this._island = new Island(this._themeConfig, this._messageCenter, _zr, {}, this);
            this.chart.island = this._island;

            // 内置通用组件
            // 工具箱
            var Toolbox = require('vendor/echarts/component/toolbox');
            this._toolbox = new Toolbox(this._themeConfig, this._messageCenter, _zr, {}, this);
            this.component.toolbox = this._toolbox;

            var componentLibrary = require('vendor/echarts/component');
            componentLibrary.define('title', require('vendor/echarts/component/title'));
            componentLibrary.define('tooltip', require('vendor/echarts/component/tooltip'));
            componentLibrary.define('legend', require('vendor/echarts/component/legend'));
            componentLibrary.define('dataRange', require('vendor/echarts/component/dataRange'));

            if (_zr.getWidth() === 0 || _zr.getHeight() === 0) {
                console.error('Dom’s width & height should be ready before init.');
            }
        },

        /**
         * ECharts事件处理中心
         */
        __onevent: function (param){
            param.__echartsId = param.__echartsId || this.id;

            // 来自其他联动图表的事件
            var fromMyself = (param.__echartsId === this.id);

            if (!this._curEventType) {
                this._curEventType = param.type;
            }

            switch (param.type) {
                case ecConfig.EVENT.LEGEND_SELECTED :
                    this._onlegendSelected(param);
                    break;
                case ecConfig.EVENT.DATA_ZOOM :
                    if (!fromMyself) {
                        var dz = this.component.dataZoom;
                        if (dz) {
                            dz.silence(true);
                            dz.absoluteZoom(param.zoom);
                            dz.silence(false);
                        }
                    }
                    this._ondataZoom(param);
                    break;
                case ecConfig.EVENT.DATA_RANGE :
                    fromMyself && this._ondataRange(param);
                    break;
                case ecConfig.EVENT.MAGIC_TYPE_CHANGED :
                    if (!fromMyself) {
                        var tb = this.component.toolbox;
                        if (tb) {
                            tb.silence(true);
                            tb.setMagicType(param.magicType);
                            tb.silence(false);
                        }
                    }
                    this._onmagicTypeChanged(param);
                    break;
                case ecConfig.EVENT.DATA_VIEW_CHANGED :
                    fromMyself && this._ondataViewChanged(param);
                    break;
                case ecConfig.EVENT.TOOLTIP_HOVER :
                    fromMyself && this._tooltipHover(param);
                    break;
                case ecConfig.EVENT.RESTORE :
                    this._onrestore();
                    break;
                case ecConfig.EVENT.REFRESH :
                    fromMyself && this._onrefresh(param);
                    break;
                // 鼠标同步
                case ecConfig.EVENT.TOOLTIP_IN_GRID :
                case ecConfig.EVENT.TOOLTIP_OUT_GRID :
                    if (!fromMyself) {
                        // 只处理来自外部的鼠标同步
                        var grid = this.component.grid;
                        if (grid) {
                            this._zr.trigger(
                                'mousemove',
                                {
                                    connectTrigger: true,
                                    zrenderX: grid.getX() + param.x * grid.getWidth(),
                                    zrenderY: grid.getY() + param.y * grid.getHeight()
                                }
                            );
                        }
                    }
                    else if (this._connected) {
                        // 来自自己，并且存在多图联动，空间坐标映射修改参数分发
                        var grid = this.component.grid;
                        if (grid) {
                            param.x = (param.event.zrenderX - grid.getX()) / grid.getWidth();
                            param.y = (param.event.zrenderY - grid.getY()) / grid.getHeight();
                        }
                    }
                    break;
                /*
                case ecConfig.EVENT.RESIZE :
                case ecConfig.EVENT.DATA_CHANGED :
                case ecConfig.EVENT.PIE_SELECTED :
                case ecConfig.EVENT.MAP_SELECTED :
                    break;
                */
            }

            // 多图联动，只做自己的一级事件分发，避免级联事件循环
            if (this._connected && fromMyself && this._curEventType === param.type) {
                for (var c in this._connected) {
                    this._connected[c].connectedEventHandler(param);
                }
                // 分发完毕后复位
                this._curEventType = null;
            }

            if (!fromMyself || (!this._connected && fromMyself)) {  // 处理了完联动事件复位
                this._curEventType = null;
            }
        },

        /**
         * 点击事件，响应zrender事件，包装后分发到Echarts层
         */
        _onclick: function (param) {
            callChartListMethodReverse(this, 'onclick', param);

            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(
                        ecConfig.EVENT.CLICK,
                        param.event,
                        ecData,
                        this
                    );
                }
            }
        },

        /**
         * 双击事件，响应zrender事件，包装后分发到Echarts层
         */
        _ondblclick: function (param) {
            callChartListMethodReverse(this, 'ondblclick', param);

            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(
                        ecConfig.EVENT.DBLCLICK,
                        param.event,
                        ecData,
                        this
                    );
                }
            }
        },

        /**
         * 鼠标移入事件，响应zrender事件，包装后分发到Echarts层
         */
        _onmouseover: function (param) {
            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(
                        ecConfig.EVENT.HOVER,
                        param.event,
                        ecData,
                        this
                    );
                }
            }
        },

        /**
         * 鼠标移出事件，响应zrender事件，包装后分发到Echarts层
         */
        _onmouseout: function (param) {
            if (param.target) {
                var ecData = this._eventPackage(param.target);
                if (ecData && ecData.seriesIndex != null) {
                    this._messageCenter.dispatch(
                        ecConfig.EVENT.MOUSEOUT,
                        param.event,
                        ecData,
                        this
                    );
                }
            }
        },

        /**
         * dragstart回调，可计算特性实现
         */
        _ondragstart: function (param) {
            // 复位用于图表间通信拖拽标识
            this._status = {
                dragIn: false,
                dragOut: false,
                needRefresh: false
            };

            callChartListMethodReverse(this, 'ondragstart', param);
        },

        /**
         * dragging回调，可计算特性实现
         */
        _ondragenter: function (param) {
            callChartListMethodReverse(this, 'ondragenter', param);
        },

        /**
         * dragstart回调，可计算特性实现
         */
        _ondragover: function (param) {
            callChartListMethodReverse(this, 'ondragover', param);
        },

        /**
         * dragstart回调，可计算特性实现
         */
        _ondragleave: function (param) {
            callChartListMethodReverse(this, 'ondragleave', param);
        },

        /**
         * dragstart回调，可计算特性实现
         */
        _ondrop: function (param) {
            callChartListMethodReverse(this, 'ondrop', param, this._status);
            this._island.ondrop(param, this._status);
        },

        /**
         * dragdone回调 ，可计算特性实现
         */
        _ondragend: function (param) {
            callChartListMethodReverse(this, 'ondragend', param, this._status);

            this._timeline && this._timeline.ondragend(param, this._status);
            this._island.ondragend(param, this._status);

            // 发生过重计算
            if (this._status.needRefresh) {
                this._syncBackupData(this._option);

                var messageCenter = this._messageCenter;
                messageCenter.dispatch(
                    ecConfig.EVENT.DATA_CHANGED,
                    param.event,
                    this._eventPackage(param.target),
                    this
                );
                messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
            }
        },

        /**
         * 图例选择响应
         */
        _onlegendSelected: function (param) {
            // 用于图表间通信
            this._status.needRefresh = false;
            callChartListMethodReverse(this, 'onlegendSelected', param, this._status);

            if (this._status.needRefresh) {
                this._messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
            }
        },

        /**
         * 数据区域缩放响应
         */
        _ondataZoom: function (param) {
            // 用于图表间通信
            this._status.needRefresh = false;
            callChartListMethodReverse(this, 'ondataZoom', param, this._status);

            if (this._status.needRefresh) {
                this._messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
            }
        },

        /**
         * 值域漫游响应
         */
        _ondataRange: function (param) {
            this._clearEffect();
            // 用于图表间通信
            this._status.needRefresh = false;
            callChartListMethodReverse(this, 'ondataRange', param, this._status);

            // 没有相互影响，直接刷新即可
            if (this._status.needRefresh) {
                this._zr.refreshNextFrame();
            }
        },

        /**
         * 动态类型切换响应
         */
        _onmagicTypeChanged: function () {
            this._clearEffect();
            this._render(this._toolbox.getMagicOption());
        },

        /**
         * 数据视图修改响应
         */
        _ondataViewChanged: function (param) {
            this._syncBackupData(param.option);
            this._messageCenter.dispatch(
                ecConfig.EVENT.DATA_CHANGED,
                null,
                param,
                this
            );
            this._messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this);
        },

        /**
         * tooltip与图表间通信
         */
        _tooltipHover: function (param) {
            var tipShape = [];
            callChartListMethodReverse(this, 'ontooltipHover', param, tipShape);
        },

        /**
         * 还原
         */
        _onrestore: function () {
            this.restore();
        },

        /**
         * 刷新
         */
        _onrefresh: function (param) {
            this._refreshInside = true;
            this.refresh(param);
            this._refreshInside = false;
        },

        /**
         * 数据修改后的反向同步dataZoom持有的备份数据
         */
        _syncBackupData: function (curOption) {
            this.component.dataZoom && this.component.dataZoom.syncBackupData(curOption);
        },

        /**
         * 打包Echarts层的事件附件
         */
        _eventPackage: function (target) {
            if (target) {
                var ecData = require('vendor/echarts/util/ecData');

                var seriesIndex = ecData.get(target, 'seriesIndex');
                var dataIndex = ecData.get(target, 'dataIndex');

                dataIndex = seriesIndex != -1 && this.component.dataZoom
                            ? this.component.dataZoom.getRealDataIndex(
                                seriesIndex,
                                dataIndex
                              )
                            : dataIndex;
                return {
                    seriesIndex: seriesIndex,
                    seriesName: (ecData.get(target, 'series') || {}).name,
                    dataIndex: dataIndex,
                    data: ecData.get(target, 'data'),
                    name: ecData.get(target, 'name'),
                    value: ecData.get(target, 'value'),
                    special: ecData.get(target, 'special')
                };
            }
            return;
        },

        _noDataCheck: function(magicOption) {
            var series = magicOption.series;

            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].type == ecConfig.CHART_TYPE_MAP
                    || (series[i].data && series[i].data.length > 0)
                    || (series[i].markPoint && series[i].markPoint.data && series[i].markPoint.data.length > 0)
                    || (series[i].markLine && series[i].markLine.data && series[i].markLine.data.length > 0)
                    || (series[i].nodes && series[i].nodes.length > 0)
                    || (series[i].links && series[i].links.length > 0)
                    || (series[i].matrix && series[i].matrix.length > 0)
                    || (series[i].eventList && series[i].eventList.length > 0)
                ) {
                    return false;   // 存在任意数据则为非空数据
                }
            }
            var loadOption = (this._option && this._option.noDataLoadingOption)
                || this._themeConfig.noDataLoadingOption
                || ecConfig.noDataLoadingOption
                || {
                    text: (this._option && this._option.noDataText)
                          || this._themeConfig.noDataText
                          || ecConfig.noDataText,
                    effect: (this._option && this._option.noDataEffect)
                            || this._themeConfig.noDataEffect
                            || ecConfig.noDataEffect
                };
            // 空数据
            this.clear();
            this.showLoading(loadOption);
            return true;
        },

        /**
         * 图表渲染
         */
        _render: function (magicOption) {
            this._mergeGlobalConifg(magicOption);

            if (this._noDataCheck(magicOption)) {
                return;
            }

            var bgColor = magicOption.backgroundColor;
            if (bgColor) {
                if (!_canvasSupported
                    && bgColor.indexOf('rgba') != -1
                ) {
                    // IE6~8对RGBA的处理，filter会带来其他颜色的影响
                    var cList = bgColor.split(',');
                    this.dom.style.filter = 'alpha(opacity=' +
                        cList[3].substring(0, cList[3].lastIndexOf(')')) * 100
                        + ')';
                    cList.length = 3;
                    cList[0] = cList[0].replace('a', '');
                    this.dom.style.backgroundColor = cList.join(',') + ')';
                }
                else {
                    this.dom.style.backgroundColor = bgColor;
                }
            }

            this._zr.clearAnimation();
            this._chartList = [];

            var chartLibrary = require('vendor/echarts/chart');
            chartLibrary.define('map', require('vendor/echarts/chart/bar'));
            chartLibrary.define('map', require('vendor/echarts/chart/map'));
            chartLibrary.define('pie', require('vendor/echarts/chart/pie'));
            var componentLibrary = require('vendor/echarts/component');
            componentLibrary.define('grid', require('vendor/echarts/component/grid'));
            componentLibrary.define('dataZoom', require('vendor/echarts/component/dataZoom'));
            componentLibrary.define('axis', require('vendor/echarts/component/axis'));

            if (magicOption.xAxis || magicOption.yAxis) {
                magicOption.grid = magicOption.grid || {};
                magicOption.dataZoom = magicOption.dataZoom || {};
            }

            var componentList = [
                'title', 'legend', 'tooltip', 'dataRange', 'roamController',
                'grid', 'dataZoom', 'xAxis', 'yAxis', 'polar'
            ];

            var ComponentClass;
            var componentType;
            var component;
            for (var i = 0, l = componentList.length; i < l; i++) {
                componentType = componentList[i];
                component = this.component[componentType];

                if (magicOption[componentType]) {
                    if (component) {
                        component.refresh && component.refresh(magicOption);
                    }
                    else {
                        ComponentClass = componentLibrary.get(
                            /^[xy]Axis$/.test(componentType) ? 'axis' : componentType
                        );
                        // console.log('ComponentClass =', ComponentClass);
                        component = new ComponentClass(
                            this._themeConfig, this._messageCenter, this._zr,
                            magicOption, this, componentType
                        );
                        this.component[componentType] = component;
                    }
                    this._chartList.push(component);
                }
                else if (component) {
                    component.dispose();
                    this.component[componentType] = null;
                    delete this.component[componentType];
                }
            }

            var ChartClass;
            var chartType;
            var chart;
            var chartMap = {};      // 记录已经初始化的图表
            for (var i = 0, l = magicOption.series.length; i < l; i++) {
                chartType = magicOption.series[i].type;
                if (!chartType) {
                    console.error('series[' + i + '] chart type has not been defined.');
                    continue;
                }

                if (!chartMap[chartType]) {
                    chartMap[chartType] = true;
                    ChartClass = chartLibrary.get(chartType);
                    if (ChartClass) {
                        if (this.chart[chartType]) {
                            chart = this.chart[chartType];
                            chart.refresh(magicOption);
                        }
                        else {
                            chart = new ChartClass(
                                this._themeConfig, this._messageCenter, this._zr,
                                magicOption, this
                            );
                        }
                        this._chartList.push(chart);
                        this.chart[chartType] = chart;
                    }
                    else {
                        console.error(chartType + ' has not been required.');
                    }
                }
            }

            // 已有实例但新option不带这类图表的实例释放
            for (chartType in this.chart) {
                if (chartType != ecConfig.CHART_TYPE_ISLAND  && !chartMap[chartType]) {
                    this.chart[chartType].dispose();
                    this.chart[chartType] = null;
                    delete this.chart[chartType];
                }
            }

            this.component.grid && this.component.grid.refixAxisShape(this.component);

            this._island.refresh(magicOption);
            this._toolbox.refresh(magicOption);

            magicOption.animation && !magicOption.renderAsImage
                ? this._zr.refresh()
                : this._zr.render();

            var imgId = 'IMG' + this.id;
            var img = document.getElementById(imgId);
            if (magicOption.renderAsImage && _canvasSupported) {
                // IE8- 不支持图片渲染形式
                if (img) {
                    // 已经渲染过则更新显示
                    img.src = this.getDataURL(magicOption.renderAsImage);
                }
                else {
                    // 没有渲染过插入img dom
                    img = this.getImage(magicOption.renderAsImage);
                    img.id = imgId;
                    img.style.position = 'absolute';
                    img.style.left = 0;
                    img.style.top = 0;
                    this.dom.firstChild.appendChild(img);
                }
                this.un();
                this._zr.un();
                this._disposeChartList();
                this._zr.clear();
            }
            else if (img) {
                // 删除可能存在的img
                img.parentNode.removeChild(img);
            }
            img = null;

            this._option = magicOption;
        },

        /**
         * 还原
         */
        restore: function () {
            this._clearEffect();
            this._option = zrUtil.clone(this._optionRestore);
            this._disposeChartList();
            this._island.clear();
            this._toolbox.reset(this._option, true);
            this._render(this._option);
        },

        /**
         * 刷新
         * @param {Object=} param，可选参数，用于附带option，内部同步用，外部不建议带入数据修改，无法同步
         */
        refresh: function (param) {
            this._clearEffect();
            param = param || {};
            var magicOption = param.option;

            // 外部调用的refresh且有option带入
            if (!this._refreshInside && magicOption) {
                // 做简单的差异合并去同步内部持有的数据克隆，不建议带入数据
                // 开启数据区域缩放、拖拽重计算、数据视图可编辑模式情况下，当用户产生了数据变化后无法同步
                // 如有带入option存在数据变化，请重新setOption
                magicOption = this.getOption();
                zrUtil.merge(magicOption, param.option, true);
                zrUtil.merge(this._optionRestore, param.option, true);
                this._toolbox.reset(magicOption);
            }

            this._island.refresh(magicOption);
            this._toolbox.refresh(magicOption);

            // 停止动画
            this._zr.clearAnimation();
            // 先来后到，安顺序刷新各种图表，图表内部refresh优化检查magicOption，无需更新则不更新~
            for (var i = 0, l = this._chartList.length; i < l; i++) {
                this._chartList[i].refresh && this._chartList[i].refresh(magicOption);
            }
            this.component.grid && this.component.grid.refixAxisShape(this.component);
            this._zr.refresh();
        },

        /**
         * 释放图表实例
         */
        _disposeChartList: function () {
            this._clearEffect();

            // 停止动画
            this._zr.clearAnimation();

            var len = this._chartList.length;
            while (len--) {
                var chart = this._chartList[len];

                if (chart) {
                    var chartType = chart.type;
                    this.chart[chartType] && delete this.chart[chartType];
                    this.component[chartType] && delete this.component[chartType];
                    chart.dispose && chart.dispose();
                }
            }

            this._chartList = [];
        },

        /**
         * 非图表全局属性merge~~
         */
        _mergeGlobalConifg: function (magicOption) {
            var mergeList = [
                // 背景颜色
                'backgroundColor',

                // 拖拽重计算相关
                'calculable', 'calculableColor', 'calculableHolderColor',

                // 孤岛显示连接符
                'nameConnector', 'valueConnector',

                // 动画相关
                'animation', 'animationThreshold',
                'animationDuration', 'animationDurationUpdate',
                'animationEasing', 'addDataAnimation',

                // 默认标志图形类型列表
                'symbolList',

                // 降低图表内元素拖拽敏感度，单位ms，不建议外部干预
                'DRAG_ENABLE_TIME'
            ];

            var len = mergeList.length;
            while (len--) {
                var mergeItem = mergeList[len];
                if (magicOption[mergeItem] == null) {
                    magicOption[mergeItem] = this._themeConfig[mergeItem] != null
                        ? this._themeConfig[mergeItem]
                        : ecConfig[mergeItem];
                }
            }

            // 数值系列的颜色列表，不传则采用内置颜色，可配数组，借用zrender实例注入，会有冲突风险，先这样
            var themeColor = magicOption.color;
            if (!(themeColor && themeColor.length)) {
                themeColor = this._themeConfig.color || ecConfig.color;
            }

            this._zr.getColor = function (idx) {
                var zrColor = require('zrender/tool/color');
                return zrColor.getColor(idx, themeColor);
            };

            if (!_canvasSupported) {
                // 不支持Canvas的强制关闭动画
                magicOption.animation = false;
                magicOption.addDataAnimation = false;
            }
        },

        /**
         * 万能接口，配置图表实例任何可配置选项，多次调用时option选项做merge处理
         * @param {Object} option
         * @param {boolean=} notMerge 多次调用时option选项是默认是合并（merge）的，
         *                   如果不需求，可以通过notMerger参数为true阻止与上次option的合并
         */
        setOption: function (option, notMerge) {
            if (!option.timeline) {
                return this._setOption(option, notMerge);
            }
            else {
                return this._setTimelineOption(option);
            }
        },

        /**
         * 万能接口，配置图表实例任何可配置选项，多次调用时option选项做merge处理
         * @param {Object} option
         * @param {boolean=} notMerge 多次调用时option选项是默认是合并（merge）的，
         *                   如果不需求，可以通过notMerger参数为true阻止与上次option的合并
         * @param {boolean=} 默认false。keepTimeLine 表示从timeline组件调用而来，
         *                   表示当前行为是timeline的数据切换，保持timeline，
         *                   反之销毁timeline。 详见Issue #1601
         */
        _setOption: function (option, notMerge, keepTimeLine) {
            if (!notMerge && this._option) {
                this._option = zrUtil.merge(
                    this.getOption(),
                    zrUtil.clone(option),
                    true
                );
            }
            else {
                this._option = zrUtil.clone(option);
                !keepTimeLine && this._timeline && this._timeline.dispose();
            }

            this._optionRestore = zrUtil.clone(this._option);

            if (!this._option.series || this._option.series.length === 0) {
                this._zr.clear();
                return;
            }

            if (this.component.dataZoom                         // 存在dataZoom控件
                && (this._option.dataZoom                       // 并且新option也存在
                    || (this._option.toolbox
                        && this._option.toolbox.feature
                        && this._option.toolbox.feature.dataZoom
                        && this._option.toolbox.feature.dataZoom.show
                    )
                )
            ) {
                // dataZoom同步数据
                this.component.dataZoom.syncOption(this._option);
            }
            this._toolbox.reset(this._option);
            this._render(this._option);
            return this;
        },

        /**
         * 返回内部持有的当前显示option克隆
         */
        getOption: function () {
            var magicOption = zrUtil.clone(this._option);

            var self = this;
            function restoreOption(prop) {
                var restoreSource = self._optionRestore[prop];

                if (restoreSource) {
                    if (restoreSource instanceof Array) {
                        var len = restoreSource.length;
                        while (len--) {
                            magicOption[prop][len].data = zrUtil.clone(
                                restoreSource[len].data
                            );
                        }
                    }
                    else {
                        magicOption[prop].data = zrUtil.clone(restoreSource.data);
                    }
                }
            }

            // 横轴数据还原
            restoreOption('xAxis');

            // 纵轴数据还原
            restoreOption('yAxis');

            // 系列数据还原
            restoreOption('series');

            return magicOption;
        },

        /**
         * 数据设置快捷接口
         * @param {Array} series
         * @param {boolean=} notMerge 多次调用时option选项是默认是合并（merge）的，
         *                   如果不需求，可以通过notMerger参数为true阻止与上次option的合并。
         */
        setSeries: function (series, notMerge) {
            if (!notMerge) {
                this.setOption({series: series});
            }
            else {
                this._option.series = series;
                this.setOption(this._option, notMerge);
            }
            return this;
        },

        /**
         * 返回内部持有的当前显示series克隆
         */
        getSeries: function () {
            return this.getOption().series;
        },

        /**
         * timelineOption接口，配置图表实例任何可配置选项
         * @param {Object} option
         */
        _setTimelineOption: function(option) {
            this._timeline && this._timeline.dispose();
            var Timeline = require('vendor/echarts/component/timeline');
            var timeline = new Timeline(
                this._themeConfig, this._messageCenter, this._zr, option, this
            );
            this._timeline = timeline;
            this.component.timeline = this._timeline;

            return this;
        },

        /**
         * 动态数据添加
         * 形参为单组数据参数，多组时为数据，内容同[seriesIdx, data, isShift, additionData]
         * @param {number} seriesIdx 系列索引
         * @param {number | Object} data 增加数据
         * @param {boolean=} isHead 是否队头加入，默认，不指定或false时为队尾插入
         * @param {boolean=} dataGrow 是否增长数据队列长度，默认，不指定或false时移出目标数组对位数据
         * @param {string=} additionData 是否增加类目轴(饼图为图例)数据，附加操作同isHead和dataGrow
         */
        addData: function (seriesIdx, data, isHead, dataGrow, additionData) {
            var params = seriesIdx instanceof Array
                ? seriesIdx
                : [[seriesIdx, data, isHead, dataGrow, additionData]];

            //this._optionRestore 和 magicOption 都要同步
            var magicOption = this.getOption();
            var optionRestore = this._optionRestore;
            var self = this;
            for (var i = 0, l = params.length; i < l; i++) {
                seriesIdx = params[i][0];
                data = params[i][1];
                isHead = params[i][2];
                dataGrow = params[i][3];
                additionData = params[i][4];

                var seriesItem = optionRestore.series[seriesIdx];
                var inMethod = isHead ? 'unshift' : 'push';
                var outMethod = isHead ? 'pop' : 'shift';
                if (seriesItem) {
                    var seriesItemData = seriesItem.data;
                    var mSeriesItemData = magicOption.series[seriesIdx].data;

                    seriesItemData[inMethod](data);
                    mSeriesItemData[inMethod](data);
                    if (!dataGrow) {
                        seriesItemData[outMethod]();
                        data = mSeriesItemData[outMethod]();
                    }

                    if (additionData != null) {
                        var legend;
                        var legendData;

                        if (seriesItem.type === ecConfig.CHART_TYPE_PIE
                            && (legend = optionRestore.legend)
                            && (legendData = legend.data)
                        ) {
                            var mLegendData = magicOption.legend.data;
                            legendData[inMethod](additionData);
                            mLegendData[inMethod](additionData);

                            if (!dataGrow) {
                                var legendDataIdx = zrUtil.indexOf(legendData, data.name);
                                legendDataIdx != -1 && legendData.splice(legendDataIdx, 1);

                                legendDataIdx = zrUtil.indexOf(mLegendData, data.name);
                                legendDataIdx != -1 && mLegendData.splice(legendDataIdx, 1);
                            }
                        }
                        else if (optionRestore.xAxis != null && optionRestore.yAxis != null) {
                            // x轴类目
                            var axisData;
                            var mAxisData;
                            var axisIdx = seriesItem.xAxisIndex || 0;

                            if (optionRestore.xAxis[axisIdx].type == null
                                || optionRestore.xAxis[axisIdx].type === 'category'
                            ) {
                                axisData = optionRestore.xAxis[axisIdx].data;
                                mAxisData = magicOption.xAxis[axisIdx].data;

                                axisData[inMethod](additionData);
                                mAxisData[inMethod](additionData);
                                if (!dataGrow) {
                                    axisData[outMethod]();
                                    mAxisData[outMethod]();
                                }
                            }

                            // y轴类目
                            axisIdx = seriesItem.yAxisIndex || 0;
                            if (optionRestore.yAxis[axisIdx].type === 'category') {
                                axisData = optionRestore.yAxis[axisIdx].data;
                                mAxisData = magicOption.yAxis[axisIdx].data;

                                axisData[inMethod](additionData);
                                mAxisData[inMethod](additionData);
                                if (!dataGrow) {
                                    axisData[outMethod]();
                                    mAxisData[outMethod]();
                                }
                            }
                        }
                    }

                    // 同步图表内状态，动画需要
                    this._option.series[seriesIdx].data = magicOption.series[seriesIdx].data;
                }
            }

            this._zr.clearAnimation();
            var chartList = this._chartList;
            var chartAnimationCount = 0;
            var chartAnimationDone = function () {
                chartAnimationCount--;
                if (chartAnimationCount === 0) {
                    animationDone();
                }
            };
            for (var i = 0, l = chartList.length; i < l; i++) {
                if (magicOption.addDataAnimation && chartList[i].addDataAnimation) {
                    chartAnimationCount++;
                    chartList[i].addDataAnimation(params, chartAnimationDone);
                }
            }

            // dataZoom同步数据
            this.component.dataZoom && this.component.dataZoom.syncOption(magicOption);

            this._option = magicOption;
            function animationDone() {
                if (!self._zr) {
                    return; // 已经被释放
                }
                self._zr.clearAnimation();
                for (var i = 0, l = chartList.length; i < l; i++) {
                    // 有addData动画就去掉过渡动画
                    chartList[i].motionlessOnce =
                        magicOption.addDataAnimation && chartList[i].addDataAnimation;
                }
                self._messageCenter.dispatch(
                    ecConfig.EVENT.REFRESH,
                    null,
                    {option: magicOption},
                    self
                );
            }

            if (!magicOption.addDataAnimation) {
                setTimeout(animationDone, 0);
            }
            return this;
        },

        /**
         * 动态[标注 | 标线]添加
         * @param {number} seriesIdx 系列索引
         * @param {Object} markData [标注 | 标线]对象，支持多个
         */
        addMarkPoint: function (seriesIdx, markData) {
            return this._addMark(seriesIdx, markData, 'markPoint');
        },

        addMarkLine: function (seriesIdx, markData) {
            return this._addMark(seriesIdx, markData, 'markLine');
        },

        _addMark: function (seriesIdx, markData, markType) {
            var series = this._option.series;
            var seriesItem;

            if (series && (seriesItem = series[seriesIdx])) {
                var seriesR = this._optionRestore.series;
                var seriesRItem = seriesR[seriesIdx];
                var markOpt = seriesItem[markType];
                var markOptR = seriesRItem[markType];

                markOpt = seriesItem[markType] = markOpt || {data: []};
                markOptR = seriesRItem[markType] = markOptR || {data: []};

                for (var key in markData) {
                    if (key === 'data') {
                        // 数据concat
                        markOpt.data = markOpt.data.concat(markData.data);
                        markOptR.data = markOptR.data.concat(markData.data);
                    }
                    else if (typeof markData[key] != 'object' || markOpt[key] == null) {
                        // 简单类型或新值直接赋值
                        markOpt[key] = markOptR[key] = markData[key];
                    }
                    else {
                        // 非数据的复杂对象merge
                        zrUtil.merge(markOpt[key], markData[key], true);
                        zrUtil.merge(markOptR[key], markData[key], true);
                    }
                }

                var chart = this.chart[seriesItem.type];
                chart && chart.addMark(seriesIdx, markData, markType);
            }

            return this;
        },

        /**
         * 动态[标注 | 标线]删除
         * @param {number} seriesIdx 系列索引
         * @param {string} markName [标注 | 标线]名称
         */
        delMarkPoint: function (seriesIdx, markName) {
            return this._delMark(seriesIdx, markName, 'markPoint');
        },

        delMarkLine: function (seriesIdx, markName) {
            return this._delMark(seriesIdx, markName, 'markLine');
        },

        _delMark: function (seriesIdx, markName, markType) {
            var series = this._option.series;
            var seriesItem;
            var mark;
            var dataArray;

            if (!(
                    series
                    && (seriesItem = series[seriesIdx])
                    && (mark = seriesItem[markType])
                    && (dataArray = mark.data)
                )
            ) {
                return this;
            }

            markName = markName.split(' > ');
            var targetIndex = -1;

            for (var i = 0, l = dataArray.length; i < l; i++) {
                var dataItem = dataArray[i];
                if (dataItem instanceof Array) {
                    if (dataItem[0].name === markName[0]
                        && dataItem[1].name === markName[1]
                    ) {
                        targetIndex = i;
                        break;
                    }
                }
                else if (dataItem.name === markName[0]) {
                    targetIndex = i;
                    break;
                }
            }

            if (targetIndex > -1) {
                dataArray.splice(targetIndex, 1);
                this._optionRestore.series[seriesIdx][markType].data.splice(targetIndex, 1);

                var chart = this.chart[seriesItem.type];
                chart && chart.delMark(seriesIdx, markName.join(' > '), markType);
            }

            return this;
        },

        /**
         * 获取当前dom
         */
        getDom: function () {
            return this.dom;
        },

        /**
         * 获取当前zrender实例，可用于添加额为的shape和深度控制
         */
        getZrender: function () {
            return this._zr;
        },

        /**
         * 获取Base64图片dataURL
         * @param {string} imgType 图片类型，支持png|jpeg，默认为png
         * @return imgDataURL
         */
        getDataURL: function (imgType) {
            if (!_canvasSupported) {
                return '';
            }

            if (this._chartList.length === 0) {
                // 渲染为图片
                var imgId = 'IMG' + this.id;
                var img = document.getElementById(imgId);
                if (img) {
                    return img.src;
                }
            }

            // 清除可能存在的tooltip元素
            var tooltip = this.component.tooltip;
            tooltip && tooltip.hideTip();

            switch (imgType) {
                case 'jpeg':
                    break;
                default:
                    imgType = 'png';
            }

            var bgColor = this._option.backgroundColor;
            if (bgColor && bgColor.replace(' ','') === 'rgba(0,0,0,0)') {
                bgColor = '#fff';
            }

            return this._zr.toDataURL('image/' + imgType, bgColor);
        },

        /**
         * 获取img
         * @param {string} imgType 图片类型，支持png|jpeg，默认为png
         * @return img dom
         */
        getImage: function (imgType) {
            var title = this._optionRestore.title;
            var imgDom = document.createElement('img');
            imgDom.src = this.getDataURL(imgType);
            imgDom.title = (title && title.text) || 'ECharts';
            return imgDom;
        },

        /**
         * 获取多图联动的Base64图片dataURL
         * @param {string} imgType 图片类型，支持png|jpeg，默认为png
         * @return imgDataURL
         */
        getConnectedDataURL: function (imgType) {
            if (!this.isConnected()) {
                return this.getDataURL(imgType);
            }

            var tempDom = this.dom;
            var imgList = {
                'self': {
                    img: this.getDataURL(imgType),
                    left: tempDom.offsetLeft,
                    top: tempDom.offsetTop,
                    right: tempDom.offsetLeft + tempDom.offsetWidth,
                    bottom: tempDom.offsetTop + tempDom.offsetHeight
                }
            };

            var minLeft = imgList.self.left;
            var minTop = imgList.self.top;
            var maxRight = imgList.self.right;
            var maxBottom = imgList.self.bottom;

            for (var c in this._connected) {
                tempDom = this._connected[c].getDom();
                imgList[c] = {
                    img: this._connected[c].getDataURL(imgType),
                    left: tempDom.offsetLeft,
                    top: tempDom.offsetTop,
                    right: tempDom.offsetLeft + tempDom.offsetWidth,
                    bottom: tempDom.offsetTop + tempDom.offsetHeight
                };

                minLeft = Math.min(minLeft, imgList[c].left);
                minTop = Math.min(minTop, imgList[c].top);
                maxRight = Math.max(maxRight, imgList[c].right);
                maxBottom = Math.max(maxBottom, imgList[c].bottom);
            }

            var zrDom = document.createElement('div');
            zrDom.style.position = 'absolute';
            zrDom.style.left = '-4000px';
            zrDom.style.width = (maxRight - minLeft) + 'px';
            zrDom.style.height = (maxBottom - minTop) + 'px';
            document.body.appendChild(zrDom);

            var zrImg = require('zrender').init(zrDom);

            var ImageShape = require('zrender/shape/Image');
            for (var c in imgList) {
                zrImg.addShape(new ImageShape({
                    style: {
                        x: imgList[c].left - minLeft,
                        y: imgList[c].top - minTop,
                        image: imgList[c].img
                    }
                }));
            }

            zrImg.render();
            var bgColor = this._option.backgroundColor;
            if (bgColor && bgColor.replace(/ /g, '') === 'rgba(0,0,0,0)') {
                bgColor = '#fff';
            }

            var image = zrImg.toDataURL('image/png', bgColor);

            setTimeout(function () {
                zrImg.dispose();
                zrDom.parentNode.removeChild(zrDom);
                zrDom = null;
            }, 100);

            return image;
        },

        /**
         * 获取多图联动的img
         * @param {string} imgType 图片类型，支持png|jpeg，默认为png
         * @return img dom
         */
        getConnectedImage: function (imgType) {
            var title = this._optionRestore.title;
            var imgDom = document.createElement('img');
            imgDom.src = this.getConnectedDataURL(imgType);
            imgDom.title = (title && title.text) || 'ECharts';
            return imgDom;
        },

        /**
         * 外部接口绑定事件
         * @param {Object} eventName 事件名称
         * @param {Object} eventListener 事件响应函数
         */
        on: function (eventName, eventListener) {
            this._messageCenterOutSide.bind(eventName, eventListener, this);
            return this;
        },

        /**
         * 外部接口解除事件绑定
         * @param {Object} eventName 事件名称
         * @param {Object} eventListener 事件响应函数
         */
        un: function (eventName, eventListener) {
            this._messageCenterOutSide.unbind(eventName, eventListener);
            return this;
        },

        /**
         * 多图联动
         * @param connectTarget{ECharts | Array <ECharts>} connectTarget 联动目标
         */
        connect: function (connectTarget) {
            if (!connectTarget) {
                return this;
            }

            if (!this._connected) {
                this._connected = {};
            }

            if (connectTarget instanceof Array) {
                for (var i = 0, l = connectTarget.length; i < l; i++) {
                    this._connected[connectTarget[i].id] = connectTarget[i];
                }
            }
            else {
                this._connected[connectTarget.id] = connectTarget;
            }

            return this;
        },

        /**
         * 解除多图联动
         * @param connectTarget{ECharts | Array <ECharts>} connectTarget 解除联动目标
         */
        disConnect: function (connectTarget) {
            if (!connectTarget || !this._connected) {
                return this;
            }

            if (connectTarget instanceof Array) {
                for (var i = 0, l = connectTarget.length; i < l; i++) {
                    delete this._connected[connectTarget[i].id];
                }
            }
            else {
                delete this._connected[connectTarget.id];
            }

            for (var k in this._connected) {
                return k, this; // 非空
            }

            // 空，转为标志位
            this._connected = false;
            return this;
        },

        /**
         * 联动事件响应
         */
        connectedEventHandler: function (param) {
            if (param.__echartsId != this.id) {
                // 来自其他联动图表的事件
                this._onevent(param);
            }
        },

        /**
         * 是否存在多图联动
         */
        isConnected: function () {
            return !!this._connected;
        },

        /**
         * 显示loading过渡
         * @param {Object} loadingOption
         */
        showLoading: function (loadingOption) {
            var effectList = {
                bar: require('zrender/loadingEffect/Bar'),
                bubble: require('zrender/loadingEffect/Bubble'),
                dynamicLine: require('zrender/loadingEffect/DynamicLine'),
                ring: require('zrender/loadingEffect/Ring'),
                spin: require('zrender/loadingEffect/Spin'),
                whirling: require('zrender/loadingEffect/Whirling')
            };
            this._toolbox.hideDataView();

            loadingOption = loadingOption || {};

            var textStyle = loadingOption.textStyle || {};
            loadingOption.textStyle = textStyle;

            var finalTextStyle = zrUtil.merge(
                zrUtil.merge(
                    zrUtil.clone(textStyle),
                    this._themeConfig.textStyle
                ),
                ecConfig.textStyle
            );

            textStyle.textFont = finalTextStyle.fontStyle + ' '
                                 + finalTextStyle.fontWeight + ' '
                                 + finalTextStyle.fontSize + 'px '
                                 + finalTextStyle.fontFamily;

            textStyle.text = loadingOption.text
                             || (this._option && this._option.loadingText)
                             || this._themeConfig.loadingText
                             || ecConfig.loadingText;

            if (loadingOption.x != null) {
                textStyle.x = loadingOption.x;
            }
            if (loadingOption.y != null) {
                textStyle.y = loadingOption.y;
            }

            loadingOption.effectOption = loadingOption.effectOption || {};
            loadingOption.effectOption.textStyle = textStyle;

            var Effect = loadingOption.effect;
            if (typeof Effect === 'string' || Effect == null) {
                Effect =  effectList[
                              loadingOption.effect
                              || (this._option && this._option.loadingEffect)
                              || this._themeConfig.loadingEffect
                              || ecConfig.loadingEffect
                          ]
                          || effectList.spin;
            }
            this._zr.showLoading(new Effect(loadingOption.effectOption));
            return this;
        },

        /**
         * 隐藏loading过渡
         */
        hideLoading: function () {
            this._zr.hideLoading();
            return this;
        },

        /**
         * 主题设置
         */
        setTheme: function (theme) {
            if (theme) {
               if (typeof theme === 'string') {
                    // 默认主题
                    switch (theme) {
                        case 'macarons':
                            theme = require('vendor/echarts/theme/macarons');
                            break;
                        case 'infographic':
                            theme = require('vendor/echarts/theme/infographic');
                            break;
                        default:
                            theme = {}; // require('./theme/default');
                    }
                }
                else {
                    theme = theme || {};
                }

                // // 复位默认配置
                // // this._themeConfig会被别的对象引用持有
                // // 所以不能改成this._themeConfig = {};
                // for (var key in this._themeConfig) {
                //     delete this._themeConfig[key];
                // }
                // for (var key in ecConfig) {
                //     this._themeConfig[key] = zrUtil.clone(ecConfig[key]);
                // }

                // // 颜色数组随theme，不merge
                // theme.color && (this._themeConfig.color = []);

                // // 默认标志图形类型列表，不merge
                // theme.symbolList && (this._themeConfig.symbolList = []);

                // // 应用新主题
                // zrUtil.merge(this._themeConfig, zrUtil.clone(theme), true);
                this._themeConfig = theme;
            }

            if (!_canvasSupported) {   // IE8-
                var textStyle = this._themeConfig.textStyle;
                textStyle && textStyle.fontFamily && textStyle.fontFamily2
                    && (textStyle.fontFamily = textStyle.fontFamily2);

                textStyle = ecConfig.textStyle;
                textStyle.fontFamily = textStyle.fontFamily2;
            }

            this._timeline && this._timeline.setTheme(true);
            this._optionRestore && this.restore();
        },

        /**
         * 视图区域大小变化更新，不默认绑定，供使用方按需调用
         */
        resize: function () {
            var self = this;
            return function(){
                self._clearEffect();
                self._zr.resize();
                if (self._option && self._option.renderAsImage && _canvasSupported) {
                    // 渲染为图片重走render模式
                    self._render(self._option);
                    return self;
                }
                // 停止动画
                self._zr.clearAnimation();
                self._island.resize();
                self._toolbox.resize();
                self._timeline && self._timeline.resize();
                // 先来后到，不能仅刷新自己，也不能在上一个循环中刷新，如坐标系数据改变会影响其他图表的大小
                // 所以安顺序刷新各种图表，图表内部refresh优化无需更新则不更新~
                for (var i = 0, l = self._chartList.length; i < l; i++) {
                    self._chartList[i].resize && self._chartList[i].resize();
                }
                self.component.grid && self.component.grid.refixAxisShape(self.component);
                self._zr.refresh();
                self._messageCenter.dispatch(ecConfig.EVENT.RESIZE, null, null, self);
                return self;
            };
        },

        _clearEffect: function() {
            this._zr.modLayer(ecConfig.EFFECT_ZLEVEL, { motionBlur: false });
            this._zr.painter.clearLayer(ecConfig.EFFECT_ZLEVEL);
        },

        /**
         * 清除已渲染内容 ，clear后echarts实例可用
         */
        clear: function () {
            this._disposeChartList();
            this._zr.clear();
            this._option = {};
            this._optionRestore = {};
            this.dom.style.backgroundColor = null;
            return this;
        },

        /**
         * 释放，dispose后echarts实例不可用
         */
        dispose: function () {
            var key = this.dom.getAttribute(DOM_ATTRIBUTE_KEY);
            key && delete _instances[key];

            this._island.dispose();
            this._toolbox.dispose();
            this._timeline && this._timeline.dispose();
            this._messageCenter.unbind();
            this.clear();
            this._zr.dispose();
            this._zr = null;
        }
    };

    return self;
});