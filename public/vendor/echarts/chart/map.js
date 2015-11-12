/**
 * echarts图表类：地图
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var ChartBase = require('./base');

    // 图形依赖
    var TextShape = require('zrender/shape/Text');
    var PathShape = require('zrender/shape/Path');
    var CircleShape = require('zrender/shape/Circle');
    var RectangleShape = require('zrender/shape/Rectangle');
    var LineShape = require('zrender/shape/Line');
    var PolygonShape = require('zrender/shape/Polygon');
    var EllipseShape = require('zrender/shape/Ellipse');
    var ZrImage = require('zrender/shape/Image');
    // 组件依赖
    require('../component/dataRange');
    require('../component/roamController');
    var HeatmapLayer = require('../layer/heatmap');

    var ecConfig = require('../config');
    // 地图默认参数
    ecConfig.map = {
        zlevel: 0,                  // 一级层叠
        z: 2,                       // 二级层叠
        mapType: 'china',   // 各省的mapType暂时都用中文
        //mapLocation: {
            // x: 'center' | 'left' | 'right' | 'x%' | {number},
            // y: 'center' | 'top' | 'bottom' | 'x%' | {number}
            // width    // 自适应
            // height   // 自适应
        //},
        // mapValueCalculation: 'sum',  // 数值合并方式，默认加和，可选为：
                                        // 'sum' | 'average' | 'max' | 'min'
        // mapValuePrecision: 0,           // 地图数值计算结果小数精度
        showLegendSymbol: true,         // 显示图例颜色标识（系列标识的小圆点），存在legend时生效
        // selectedMode: false,         // 选择模式，默认关闭，可选single，multiple
        dataRangeHoverLink: true,
        hoverable: true,
        clickable: true,
        // roam: false,                 // 是否开启缩放及漫游模式
        // scaleLimit: null,
        itemStyle: {
            normal: {
                // color: 各异,
                borderColor: 'rgba(0,0,0,0)',
                borderWidth: 1,
                areaStyle: {
                    color: '#ccc'
                },
                label: {
                    show: false,
                    textStyle: {
                        color: 'rgb(139,69,19)'
                    }
                }
            },
            emphasis: {                 // 也是选中样式
                // color: 各异,
                borderColor: 'rgba(0,0,0,0)',
                borderWidth: 1,
                areaStyle: {
                    color: 'rgba(255,215,0,0.8)'
                },
                label: {
                    show: false,
                    textStyle: {
                        color: 'rgb(100,0,0)'
                    }
                }
            }
        }
    };

    var ecData = require('../util/ecData');
    var zrUtil = require('zrender/tool/util');
    var zrConfig = require('zrender/config');
    var zrEvent = require('zrender/tool/event');

    var _mapParams = require('../util/mapData/params').params;
    var _textFixed = require('../util/mapData/textFixed');
    var _geoCoord = require('../util/mapData/geoCoord');

    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} series 数据
     * @param {Object} component 组件
     */
    function Map(ecTheme, messageCenter, zr, option, myChart){
        // 图表基类
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);

        var self = this;
        self._onmousewheel = function(params) {
            return self.__onmousewheel(params);
        };
        self._onmousedown = function(params) {
            return self.__onmousedown(params);
        };
        self._onmousemove = function(params) {
            return self.__onmousemove(params);
        };
        self._onmouseup = function(params) {
            return self.__onmouseup(params);
        };
        self._onroamcontroller = function(params) {
            return self.__onroamcontroller(params);
        };
        self._ondrhoverlink = function(params) {
            return self.__ondrhoverlink(params);
        };

        this._isAlive = true;           // 活着标记
        this._selectedMode = {};        // 选择模式
        this._activeMapType = {};       // 当前活跃的地图类型
        this._clickable = {};           // 悬浮高亮模式，索引到图表
        this._hoverable = {};           // 悬浮高亮模式，索引到图表
        this._showLegendSymbol = {};    // 显示图例颜色标识
        this._selected = {};            // 地图选择状态
        this._mapTypeMap = {};          // 图例类型索引
        this._mapDataMap = {};          // 根据地图类型索引bbox,transform,path
        this._nameMap = {};             // 个性化地名
        this._specialArea = {};         // 特殊
        this._refreshDelayTicket;       // 滚轮缩放时让refresh飞一会
        this._mapDataRequireCounter;    // 异步回调计数器
        this._markAnimation = false;
        this._hoverLinkMap = {};

        // 漫游相关信息
        this._roamMap = {};
        this._scaleLimitMap = {};
        this._mx;
        this._my;
        this._mousedown;
        this._justMove;   // 避免移动响应点击
        this._curMapType; // 当前移动的地图类型

        this.refresh(option);

        this.zr.on(zrConfig.EVENT.MOUSEWHEEL, this._onmousewheel);
        this.zr.on(zrConfig.EVENT.MOUSEDOWN, this._onmousedown);
        messageCenter.bind(ecConfig.EVENT.ROAMCONTROLLER, this._onroamcontroller);
        messageCenter.bind(ecConfig.EVENT.DATA_RANGE_HOVERLINK, this._ondrhoverlink);
    }

    Map.prototype = {
        type : ecConfig.CHART_TYPE_MAP,
        /**
         * 绘制图形
         */
        /**
         * @function name:  _buildShape : function ()
         * @description:    Add try catch block for exception handling.
         * @related issues: OWL-052
         * @param:          void
         * @return:         void
         * @author:         Don Hsieh
         * @since:          08/27/2015
         * @last modified:  08/27/2015
         * @called by:
         */
        _buildShape : function () {
            var series = this.series;
            this.selectedMap = {}; // 系列
            this._activeMapType = {}; // 当前活跃的地图类型

            var legend = this.component.legend;
            var seriesName;
            var valueData = {};
            var mapType;
            var data;
            var name;
            var mapSeries = {};
            var mapValuePrecision = {};
            var valueCalculation = {};
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].type == ecConfig.CHART_TYPE_MAP) { // map
                    series[i] = this.reformOption(series[i]);
                    mapType = series[i].mapType;
                    mapSeries[mapType] = mapSeries[mapType] || {};
                    mapSeries[mapType][i] = true;
                    mapValuePrecision[mapType] = mapValuePrecision[mapType]
                                                 || series[i].mapValuePrecision;
                    this._scaleLimitMap[mapType] = this._scaleLimitMap[mapType] || {};
                    series[i].scaleLimit
                        && zrUtil.merge(this._scaleLimitMap[mapType], series[i].scaleLimit, true);

                    this._roamMap[mapType] = series[i].roam || this._roamMap[mapType];

                    if (this._hoverLinkMap[mapType] == null || this._hoverLinkMap[mapType]) {
                        // false 1票否决
                        this._hoverLinkMap[mapType] = series[i].dataRangeHoverLink;
                    }

                    this._nameMap[mapType] = this._nameMap[mapType] || {};
                    series[i].nameMap
                        && zrUtil.merge(this._nameMap[mapType], series[i].nameMap, true);
                    this._activeMapType[mapType] = true;

                    if (series[i].textFixed) {
                        zrUtil.merge(
                            _textFixed, series[i].textFixed, true
                        );
                    }
                    if (series[i].geoCoord) {
                        zrUtil.merge(
                            _geoCoord, series[i].geoCoord, true
                        );
                    }

                    this._selectedMode[mapType] = this._selectedMode[mapType]
                                                  || series[i].selectedMode;
                    if (this._hoverable[mapType] == null || this._hoverable[mapType]) {
                        // false 1票否决
                        this._hoverable[mapType] = series[i].hoverable;
                    }
                    if (this._clickable[mapType] == null || this._clickable[mapType]) {
                        // false 1票否决
                        this._clickable[mapType] = series[i].clickable;
                    }
                    if (this._showLegendSymbol[mapType] == null
                        || this._showLegendSymbol[mapType]
                    ) {
                        // false 1票否决
                        this._showLegendSymbol[mapType] = series[i].showLegendSymbol;
                    }

                    valueCalculation[mapType] = valueCalculation[mapType]
                                                || series[i].mapValueCalculation;

                    seriesName = series[i].name;
                    this.selectedMap[seriesName] = legend
                        ? legend.isSelected(seriesName)
                        : true;
                    if (this.selectedMap[seriesName]) {
                        valueData[mapType] = valueData[mapType] || {};
                        data = series[i].data;
                        for (var j = 0, k = data.length; j < k; j++) {
                            name = this._nameChange(mapType, data[j].name);
                            valueData[mapType][name] = valueData[mapType][name]
                                                       || {
                                                           seriesIndex : [],
                                                           valueMap: {},
                                                           precision: 0
                                                       };
                            for (var key in data[j]) {
                                if (key != 'value') {
                                    valueData[mapType][name][key] =
                                        data[j][key];
                                }
                                else if (!isNaN(data[j].value)) {
                                    // value
                                    valueData[mapType][name].value == null
                                    && (valueData[mapType][name].value = 0);

                                    valueData[mapType][name].precision = 
                                        Math.max(
                                            this.getPrecision(+data[j].value),
                                            valueData[mapType][name].precision
                                        );

                                    valueData[mapType][name].value += (+data[j].value);
                                    valueData[mapType][name].valueMap[i] = +data[j].value;
                                }
                            }
                            //索引有该区域的系列样式
                            valueData[mapType][name].seriesIndex.push(i);
                        }
                    }
                }
            }

            this._mapDataRequireCounter = 0;
            for (var mt in valueData) {
                this._mapDataRequireCounter++;
            }
            //清空
            this._clearSelected();
            if (this._mapDataRequireCounter === 0) {
                this.clear();
                this.zr && this.zr.delShape(this.lastShapeList);
                this.lastShapeList = [];
            }
            for (var mt in valueData) {
                for (var k in valueData[mt]) {
                    if (valueCalculation[mt] == 'average') {
                        valueData[mt][k].value /= valueData[mt][k].seriesIndex.length;
                    }
                    var value = valueData[mt][k].value;
                    if (value != null) {
                        valueData[mt][k].value = value.toFixed(
                            mapValuePrecision[mt] == null
                                ? valueData[mt][k].precision : mapValuePrecision[mt]
                        ) - 0;   
                    }
                }

                this._mapDataMap[mt] = this._mapDataMap[mt] || {};
                try {
                    if (this._mapDataMap[mt].mapData) {
                        // 已经缓存了则直接用
                        this._mapDataCallback(mt, valueData[mt], mapSeries[mt])(
                            this._mapDataMap[mt].mapData
                        );
                    }
                    else if (_mapParams[mt.replace(/\|.*/, '')]) {
                        // 特殊区域
                        if (_mapParams[mt.replace(/\|.*/, '')].getGeoJson) {
                            this._specialArea[mt] =
                                _mapParams[mt.replace(/\|.*/, '')].specialArea
                                || this._specialArea[mt];
                            _mapParams[mt.replace(/\|.*/, '')].getGeoJson(
                                this._mapDataCallback(mt, valueData[mt], mapSeries[mt])
                            );
                        }
                    }
                } catch (err) {
                    console.log('Error message:', err);
                }
            }
        },

        /**
         * @param {string} mt mapType
         * @parma {Object} vd valueData
         * @param {Object} ms mapSeries
         */
        _mapDataCallback : function (mt, vd, ms) {
            var self = this;
            return function (md) {
                if (!self._isAlive || self._activeMapType[mt] == null) {
                    // 异步地图数据回调时有可能实例已经被释放
                    return;
                }
                // 缓存这份数据
                if (mt.indexOf('|') != -1) {
                    // 子地图，加工一份新的mapData
                    md = self._getSubMapData(mt, md);
                }
                self._mapDataMap[mt].mapData = md;

                if (md.firstChild) {
                    self._mapDataMap[mt].rate = 1;
                    self._mapDataMap[mt].projection = require('../util/projection/svg');
                }
                else {
                    self._mapDataMap[mt].rate = 0.75;
                    self._mapDataMap[mt].projection = require('../util/projection/normal');
                }

                self._buildMap(
                    mt,                             // 类型
                    self._getProjectionData(mt, md, ms),      // 地图数据
                    vd,                  // 用户数据
                    ms                   // 系列
                );
                self._buildMark(mt, ms);
                if (--self._mapDataRequireCounter <= 0) {
                    self.addShapeList();
                    self.zr.refreshNextFrame();
                }

                self._buildHeatmap(mt);
            };
        },

        _clearSelected : function() {
            for (var k in this._selected) {
                if (!this._activeMapType[this._mapTypeMap[k]]) {
                    delete this._selected[k];
                    delete this._mapTypeMap[k];
                }
            }
        },

        _getSubMapData : function (mapType, mapData) {
            var subType = mapType.replace(/^.*\|/, '');
            var features = mapData.features;
            for (var i = 0, l = features.length; i < l; i++) {
                if (features[i].properties
                    && features[i].properties.name == subType
                ) {
                    features = features[i];
                    if (subType == 'United States of America'
                        && features.geometry.coordinates.length > 1 // 未被简化
                    ) {
                        features = {
                            geometry: {
                                coordinates: features.geometry
                                                     .coordinates.slice(5,6),
                                type: features.geometry.type
                            },
                            id: features.id,
                            properties: features.properties,
                            type: features.type
                        };
                    }
                    break;
                }
            }
            return {
                'type' : 'FeatureCollection',
                'features':[
                    features
                ]
            };
        },

        /**
         * 按需加载相关地图
         */
        _getProjectionData : function (mapType, mapData, mapSeries) {
            var normalProjection = this._mapDataMap[mapType].projection;
            var province = [];

            // bbox永远不变
            var bbox = this._mapDataMap[mapType].bbox
                       || normalProjection.getBbox(
                              mapData, this._specialArea[mapType]
                          );
            //console.log(bbox)

            var transform;
            //console.log(1111,transform)
            if (!this._mapDataMap[mapType].hasRoam) {
                // 第一次或者发生了resize，需要判断
                transform = this._getTransform(
                    bbox,
                    mapSeries,
                    this._mapDataMap[mapType].rate
                );
            }
            else {
                //经过用户漫游不再响应resize
                transform = this._mapDataMap[mapType].transform;
            }
            //console.log(bbox,transform)
            var lastTransform = this._mapDataMap[mapType].lastTransform
                                || {scale:{}};

            var pathArray;
            if (transform.left != lastTransform.left
                || transform.top != lastTransform.top
                || transform.scale.x != lastTransform.scale.x
                || transform.scale.y != lastTransform.scale.y
            ) {
                // 发生过变化，需要重新生成pathArray
                // 一般投射
                //console.log(transform)
                pathArray = normalProjection.geoJson2Path(
                                mapData, transform, this._specialArea[mapType]
                            );
                lastTransform = zrUtil.clone(transform);
            }
            else {
                transform = this._mapDataMap[mapType].transform;
                pathArray = this._mapDataMap[mapType].pathArray;
            }

            this._mapDataMap[mapType].bbox = bbox;
            this._mapDataMap[mapType].transform = transform;
            this._mapDataMap[mapType].lastTransform = lastTransform;
            this._mapDataMap[mapType].pathArray = pathArray;

            //console.log(pathArray)
            var position = [transform.left, transform.top];
            for (var i = 0, l = pathArray.length; i < l; i++) {
                /* for test
                console.log(
                    mapData.features[i].properties.cp, // 经纬度度
                    pathArray[i].cp                    // 平面坐标
                );
                console.log(
                    this.pos2geo(mapType, pathArray[i].cp),  // 平面坐标转经纬度
                    this.geo2pos(mapType, mapData.features[i].properties.cp)
                )
                */
                province.push(this._getSingleProvince(
                    mapType, pathArray[i], position
                ));
            }

            if (this._specialArea[mapType]) {
                for (var area in this._specialArea[mapType]) {
                    province.push(this._getSpecialProjectionData(
                        mapType, mapData,
                        area, this._specialArea[mapType][area],
                        position
                    ));
                }

            }

            // 中国地图加入南海诸岛
            // if (mapType == 'china') {
            //     var leftTop = this.geo2pos(
            //         mapType,
            //         _geoCoord['南海诸岛'] || _mapParams['南海诸岛'].textCoord
            //     );
            //     // scale.x : width  = 10.51 : 64
            //     var scale = transform.scale.x / 10.5;
            //     var textPosition = [
            //         32 * scale + leftTop[0],
            //         83 * scale + leftTop[1]
            //     ];
            //     if (_textFixed['南海诸岛']) {
            //         textPosition[0] += _textFixed['南海诸岛'][0];
            //         textPosition[1] += _textFixed['南海诸岛'][1];
            //     }
            //     province.push({
            //         name : this._nameChange(mapType, '南海诸岛'),
            //         path : _mapParams['南海诸岛'].getPath(leftTop, scale),
            //         position : position,
            //         textX : textPosition[0],
            //         textY : textPosition[1]
            //     });

            // }
            //console.log(JSON.stringify(province));
            //console.log(JSON.stringify(this._mapDataMap[mapType].transform));
            return province;
        },

        /**
         * 特殊地区投射数据
         */
        _getSpecialProjectionData : function (mapType, mapData, areaName, mapSize, position) {
            //console.log('_getSpecialProjectionData--------------')
            // 构造单独的geoJson地图数据
            mapData = this._getSubMapData('x|' + areaName, mapData);

            // bbox
            var normalProjection = require('../util/projection/normal');
            var bbox = normalProjection.getBbox(mapData);
            //console.log('bbox', bbox)

            // transform
            var leftTop = this.geo2pos(
                mapType,
                [mapSize.left, mapSize.top]
            );
            var rightBottom = this.geo2pos(
                mapType,
                [mapSize.left + mapSize.width, mapSize.top + mapSize.height]
            );
            //console.log('leftright' , leftTop, rightBottom);
            var width = Math.abs(rightBottom[0] - leftTop[0]);
            var height = Math.abs(rightBottom[1] - leftTop[1]);
            var mapWidth = bbox.width;
            var mapHeight = bbox.height;
            //var minScale;
            var xScale = (width / 0.75) / mapWidth;
            var yScale = height / mapHeight;
            if (xScale > yScale) {
                xScale = yScale * 0.75;
                width = mapWidth * xScale;
            }
            else {
                yScale = xScale;
                xScale = yScale * 0.75;
                height = mapHeight * yScale;
            }
            var transform = {
                OffsetLeft : leftTop[0],
                OffsetTop : leftTop[1],
                //width: width,
                //height: height,
                scale : {
                    x : xScale,
                    y : yScale
                }
            };

            //console.log('**',areaName, transform)
            var pathArray = normalProjection.geoJson2Path(
                mapData, transform
            );

            //console.log(pathArray)
            return this._getSingleProvince(
                mapType, pathArray[0], position
            );
        },

        _getSingleProvince : function (mapType, path, position) {
            var textPosition;
            var name = path.properties.name;
            var textFixed = _textFixed[name] || [0, 0];
            if (_geoCoord[name]) {
                // 经纬度直接定位不加textFixed
                textPosition = this.geo2pos(
                    mapType,
                    _geoCoord[name]
                );
            }
            else if (path.cp) {
                textPosition = [
                    path.cp[0] + textFixed[0],
                    path.cp[1] + textFixed[1]
                ];
            }
            else {
                var bbox = this._mapDataMap[mapType].bbox;
                textPosition = this.geo2pos(
                    mapType,
                    [bbox.left + bbox.width / 2, bbox.top + bbox.height / 2]
                );
                textPosition[0] += textFixed[0];
                textPosition[1] += textFixed[1];
            }

            //console.log(textPosition)
            path.name = this._nameChange(mapType, name);
            path.position = position;
            path.textX = textPosition[0];
            path.textY = textPosition[1];
            return path;
        },

        /**
         * 获取缩放
         */
        _getTransform : function (bbox, mapSeries, rate) {
            var series = this.series;
            var mapLocation;
            var x;
            var cusX;
            var y;
            var cusY;
            var width;
            var height;
            var zrWidth = this.zr.getWidth();
            var zrHeight = this.zr.getHeight();
            //上下左右留空
            var padding = Math.round(Math.min(zrWidth, zrHeight) * 0.02);
            for (var key in mapSeries) {
                mapLocation = series[key].mapLocation || {};
                cusX = mapLocation.x || cusX;
                cusY = mapLocation.y || cusY;
                width = mapLocation.width || width;
                height = mapLocation.height || height;
            }

            //x = isNaN(cusX) ? padding : cusX;
            x = this.parsePercent(cusX, zrWidth);
            x = isNaN(x) ? padding : x;
            //y = isNaN(cusY) ? padding : cusY;
            y = this.parsePercent(cusY, zrHeight);
            y = isNaN(y) ? padding : y;

            width = width == null
                    ? (zrWidth - x - 2 * padding)
                    : (this.parsePercent(width, zrWidth));
            height = height == null
                     ? (zrHeight - y - 2 * padding)
                     : (this.parsePercent(height, zrHeight));

            var mapWidth = bbox.width;
            var mapHeight = bbox.height;
            //var minScale;
            var xScale = (width / rate) / mapWidth;
            var yScale = height / mapHeight;
            if (xScale > yScale) {
                //minScale = yScale;
                xScale = yScale * rate;
                width = mapWidth * xScale;
            }
            else {
                //minScale = xScale;
                yScale = xScale;
                xScale = yScale * rate;
                height = mapHeight * yScale;
            }
            //console.log(minScale)
            //width = mapWidth * minScale;
            //height = mapHeight * minScale;

            if (isNaN(cusX)) {
                cusX = cusX || 'center';
                switch (cusX + '') {
                    case 'center' :
                        x = Math.floor((zrWidth - width) / 2);
                        break;
                    case 'right' :
                        x = zrWidth - width;
                        break;
                    //case 'left' :
                        //x = padding;
                }
            }
            //console.log(cusX,x,zrWidth,width,'kener')
            if (isNaN(cusY)) {
                cusY = cusY || 'center';
                switch (cusY + '') {
                    case 'center' :
                        y = Math.floor((zrHeight - height) / 2);
                        break;
                    case 'bottom' :
                        y = zrHeight - height;
                        break;
                    //case 'top' :
                        //y = padding;
                }
            }
            //console.log(x,y,width,height)
            return {
                left : x,
                top : y,
                width: width,
                height: height,
                //scale : minScale * 50,  // wtf 50
                baseScale : 1,
                scale : {
                    x : xScale,
                    y : yScale
                }
                //translate : [x + width / 2, y + height / 2]
            };
        },

        /**
         * 构建地图
         * @param {Object} mapData 图形数据
         * @param {Object} valueData 用户数据
         */
        _buildMap : function (mapType, mapData, valueData, mapSeries) {
            var series = this.series;
            var legend = this.component.legend;
            var dataRange = this.component.dataRange;
            var seriesName;
            var name;
            var data;
            var value;
            var queryTarget;

            var color;
            var font;
            var style;
            var highlightStyle;

            var shape;
            var textShape;
            for (var i = 0, l = mapData.length; i < l; i++) {
                style = zrUtil.clone(mapData[i]);
                highlightStyle = {
                    name : style.name,
                    path : style.path,
                    position : zrUtil.clone(style.position)
                };
                name = style.name;
                data = valueData[name]; // 多系列合并后的数据
                if (data) {
                    queryTarget = [data]; // level 3
                    seriesName = '';
                    for (var j = 0, k = data.seriesIndex.length; j < k; j++) {
                        var serie = series[data.seriesIndex[j]];
                        // level 2
                        queryTarget.push(serie);
                        seriesName += serie.name + ' ';
                        if (legend
                            && this._showLegendSymbol[mapType]
                            && legend.hasColor(serie.name)
                        ) {
                            this.shapeList.push(new CircleShape({
                                zlevel : serie.zlevel,
                                z : serie.z + 1,
                                position : zrUtil.clone(style.position),
                                _mapType : mapType,
                                /*
                                _geo : this.pos2geo(
                                           mapType, [style.textX + 3 + j * 7, style.textY - 10]
                                       ),
                                       */
                                style : {
                                    x : style.textX + 3 + j * 7,
                                    y : style.textY - 10,
                                    r : 3,
                                    color : legend.getColor(
                                        serie.name
                                    )
                                },
                                hoverable : false
                            }));
                        }
                    }
                    value = data.value;
                }
                else {
                    data = {
                        name: name,
                        value: '-'
                    };
                    seriesName = '';
                    queryTarget = [];
                    for (var key in mapSeries) {
                        queryTarget.push(series[key]);
                    }
                    value = '-';
                }
                this.ecTheme.map && queryTarget.push(this.ecTheme.map); // level 1
                queryTarget.push(ecConfig.map);      // level 1

                // 值域控件控制
                color = (dataRange && !isNaN(value))
                        ? dataRange.getColor(value)
                        : null;

                // 常规设置
                style.color = style.color
                              || color
                              || this.getItemStyleColor(
                                     this.deepQuery(queryTarget, 'itemStyle.normal.color'),
                                     data.seriesIndex, -1, data
                                 )
                              || this.deepQuery(
                                  queryTarget, 'itemStyle.normal.areaStyle.color'
                                 );
                style.strokeColor = style.strokeColor
                                    || this.deepQuery(queryTarget, 'itemStyle.normal.borderColor');
                style.lineWidth = style.lineWidth
                                  || this.deepQuery(queryTarget, 'itemStyle.normal.borderWidth');

                // 高亮
                highlightStyle.color = this.getItemStyleColor(
                                           this.deepQuery(queryTarget, 'itemStyle.emphasis.color'),
                                           data.seriesIndex, -1, data
                                       )
                                       || this.deepQuery(
                                              queryTarget, 'itemStyle.emphasis.areaStyle.color'
                                          )
                                       || style.color;
                highlightStyle.strokeColor = this.deepQuery(
                                                 queryTarget, 'itemStyle.emphasis.borderColor'
                                             )
                                             || style.strokeColor;
                highlightStyle.lineWidth = this.deepQuery(
                                               queryTarget, 'itemStyle.emphasis.borderWidth'
                                           )
                                           || style.lineWidth;

                style.brushType = highlightStyle.brushType = style.brushType || 'both';
                style.lineJoin = highlightStyle.lineJoin = 'round';
                style._name = highlightStyle._name = name;

                font = this.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle');
                // 文字标签避免覆盖单独一个shape
                textShape = {
                    zlevel : this.getZlevelBase(),
                    z : this.getZBase() + 1,
                    //hoverable: this._hoverable[mapType],
                    //clickable: this._clickable[mapType],
                    position : zrUtil.clone(style.position),
                    _mapType : mapType,
                    _geo : this.pos2geo(
                               mapType, [style.textX, style.textY]
                           ),
                    style : {
                        brushType : 'fill',
                        x : style.textX,
                        y : style.textY,
                        text : this.getLabelText(name, value, queryTarget, 'normal'),
                        _name : name,
                        textAlign : 'center',
                        color : this.deepQuery(queryTarget, 'itemStyle.normal.label.show')
                                ? this.deepQuery(
                                      queryTarget,
                                      'itemStyle.normal.label.textStyle.color'
                                  )
                                : 'rgba(0,0,0,0)',
                        textFont : this.getFont(font)
                    }
                };
                textShape._style = zrUtil.clone(textShape.style);

                textShape.highlightStyle = zrUtil.clone(textShape.style);
                if (this.deepQuery(queryTarget, 'itemStyle.emphasis.label.show')) {
                    textShape.highlightStyle.text = this.getLabelText(
                        name, value, queryTarget, 'emphasis'
                    );
                    textShape.highlightStyle.color = this.deepQuery(
                        queryTarget,
                        'itemStyle.emphasis.label.textStyle.color'
                    ) || textShape.style.color;
                    font = this.deepQuery(
                        queryTarget,
                        'itemStyle.emphasis.label.textStyle'
                    ) || font;
                    textShape.highlightStyle.textFont = this.getFont(font);
                }
                else {
                    textShape.highlightStyle.color = 'rgba(0,0,0,0)';
                }

                shape = {
                    zlevel : this.getZlevelBase(),
                    z : this.getZBase(),
                    //hoverable: this._hoverable[mapType],
                    //clickable: this._clickable[mapType],
                    position : zrUtil.clone(style.position),
                    style : style,
                    highlightStyle : highlightStyle,
                    _style: zrUtil.clone(style),
                    _mapType: mapType
                };
                if (style.scale != null) {
                    shape.scale = zrUtil.clone(style.scale);
                }

                textShape = new TextShape(textShape);
                switch (shape.style.shapeType) {
                    case 'rectangle' :
                        shape = new RectangleShape(shape);
                        break;
                    case 'line' :
                        shape = new LineShape(shape);
                        break;
                    case 'circle' :
                        shape = new CircleShape(shape);
                        break;
                    case 'polygon' :
                        shape = new PolygonShape(shape);
                        break;
                    case 'ellipse':
                        shape = new EllipseShape(shape);
                        break;
                    default :
                        shape = new PathShape(shape);
                        if (shape.buildPathArray) {
                            shape.style.pathArray = shape.buildPathArray(shape.style.path);
                        }
                        break;
                }

                if (this._selectedMode[mapType] &&
                     (this._selected[name] && data.selected !== false)
                     || data.selected === true
                ) {
                    textShape.style = textShape.highlightStyle;
                    shape.style = shape.highlightStyle;
                }

                textShape.clickable = shape.clickable =
                    this._clickable[mapType]
                    && (data.clickable == null || data.clickable);

                if (this._selectedMode[mapType]) {
                    this._selected[name] = this._selected[name] != null
                                           ? this._selected[name]
                                           : data.selected;
                    this._mapTypeMap[name] = mapType;

                    if (data.selectable == null || data.selectable) {
                        shape.clickable = textShape.clickable = true;
                        shape.onclick = textShape.onclick = this.shapeHandler.onclick;
                    }
                }

                if (this._hoverable[mapType]
                    && (data.hoverable == null || data.hoverable)
                ) {
                    textShape.hoverable = shape.hoverable = true;
                    shape.hoverConnect = textShape.id;
                    textShape.hoverConnect = shape.id;
                }
                else {
                    textShape.hoverable = shape.hoverable = false;
                }

                // console.log(name,shape);
                ecData.pack(
                    textShape,
                    {
                        name: seriesName,
                        tooltip: this.deepQuery(queryTarget, 'tooltip')
                    },
                    0,
                    data, 0,
                    name
                );
                this.shapeList.push(textShape);

                ecData.pack(
                    shape,
                    {
                        name: seriesName,
                        tooltip: this.deepQuery(queryTarget, 'tooltip')
                    },
                    0,
                    data, 0,
                    name
                );
                this.shapeList.push(shape);
            }
            //console.log(this._selected);
        },

        // 添加标注
        _buildMark : function (mapType, mapSeries) {
            this._seriesIndexToMapType = this._seriesIndexToMapType || {};
            this.markAttachStyle = this.markAttachStyle || {};
            var position = [
                this._mapDataMap[mapType].transform.left,
                this._mapDataMap[mapType].transform.top
            ];
            if (mapType == 'none') {
                position = [0, 0];
            }
            for (var sIdx in mapSeries) {
                this._seriesIndexToMapType[sIdx] = mapType;
                this.markAttachStyle[sIdx] = {
                    position : position,
                    _mapType : mapType
                };
                this.buildMark(sIdx);
            }
        },

        _buildHeatmap: function(mapType) {
            var series = this.series;
            for (var i = 0, l = series.length; i < l; i++) {
                // render heatmap
                if (series[i].heatmap) {
                    // convert geo position to screen position
                    var data = series[i].heatmap.data;
                    if (series[i].heatmap.needsTransform === false) {
                        // baidu map position, does not need transform
                        var geo = [];
                        for (var j = 0, len = data.length; j < len; ++j) {
                            geo.push([data[j][3], data[j][4], data[j][2]]);
                        }
                        var pos = [0, 0]
                    } else {
                        // other map
                        var geoData = series[i].heatmap._geoData;
                        // copy initial geo position
                        if (geoData === undefined) {
                            series[i].heatmap._geoData = [];
                            for (var j = 0, len = data.length; j < len; ++j) {
                                series[i].heatmap._geoData[j] = data[j];
                            }
                            geoData = series[i].heatmap._geoData;
                        }

                        var len = data.length;
                        for (var id = 0; id < len; ++id) {
                            data[id] = this.geo2pos(mapType, 
                                [geoData[id][0], geoData[id][1]]);
                        }
                        var pos = [
                            this._mapDataMap[mapType].transform.left,
                            this._mapDataMap[mapType].transform.top
                        ]
                    }
                    var layer = new HeatmapLayer(series[i].heatmap);
                    var canvas = layer.getCanvas(data[0][3] ? geo : data,
                        this.zr.getWidth(), this.zr.getHeight())
                    var image = new ZrImage({
                        zlevel: this.getZlevelBase(),
                        z: this.getZBase() + 1,
                        position: pos,
                        scale: [1, 1],
                        hoverable: false,
                        style: {
                            x: 0,
                            y: 0,
                            image: canvas,
                            width: canvas.width,
                            height: canvas.height
                        }
                    });
                    image.type = 'heatmap';
                    image._mapType = mapType;
                    this.shapeList.push(image);
                    this.zr.addShape(image);
                }
            }
        },

        // 位置转换
        getMarkCoord : function (seriesIndex, mpData) {
            return (mpData.geoCoord || _geoCoord[mpData.name])
                   ? this.geo2pos(
                         this._seriesIndexToMapType[seriesIndex],
                         mpData.geoCoord || _geoCoord[mpData.name]
                     )
                   : [0, 0];
        },

        getMarkGeo : function(mpData) {
            return mpData.geoCoord || _geoCoord[mpData.name];
        },

        _nameChange : function (mapType, name) {
            return this._nameMap[mapType][name] || name;
        },

        /**
         * 根据lable.format计算label text
         */
        getLabelText : function (name, value, queryTarget, status) {
            var formatter = this.deepQuery(
                queryTarget,
                'itemStyle.' + status + '.label.formatter'
            );
            if (formatter) {
                if (typeof formatter == 'function') {
                    return formatter.call(
                        this.myChart,
                        name,
                        value
                    );
                }
                else if (typeof formatter == 'string') {
                    formatter = formatter.replace('{a}','{a0}')
                                         .replace('{b}','{b0}');
                    formatter = formatter.replace('{a0}', name)
                                         .replace('{b0}', value);
                    return formatter;
                }
            }
            else {
                return name;
            }
        },

        _findMapTypeByPos : function (mx, my) {
            var transform;
            var left;
            var top;
            var width;
            var height;
            for (var mapType in this._mapDataMap) {
                transform = this._mapDataMap[mapType].transform;
                if (!transform || !this._roamMap[mapType] || !this._activeMapType[mapType]) {
                    continue;
                }

                left = transform.left;
                top = transform.top;
                width = transform.width;
                height = transform.height;
                if (mx >= left
                    && mx <= (left + width)
                    && my >= top
                    && my <= (top + height)
                ) {
                    return mapType;
                }
            }
            return;
        },

        /**
         * 滚轮缩放
         */
        __onmousewheel : function (params) {
            if (this.shapeList.length <= 0) {
                return;
            }

            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                var shape = this.shapeList[i];
                // If any shape is still animating
                if (shape.__animating) {
                    return;
                }
            }

            var event = params.event;
            var mx = zrEvent.getX(event);
            var my = zrEvent.getY(event);
            var delta;
            var eventDelta = zrEvent.getDelta(event);
            //eventDelta = eventDelta > 0 ? (-1) : 1;
            var mapType;
            var mapTypeControl = params.mapTypeControl;
            if (!mapTypeControl) {
                mapTypeControl = {};
                mapType = this._findMapTypeByPos(mx, my);
                if (mapType && this._roamMap[mapType] && this._roamMap[mapType] != 'move') {
                    mapTypeControl[mapType] = true;
                }
            }

            function scalePolyline(shapeStyle, delta) {
                for (var i = 0; i < shapeStyle.pointList.length; i++) {
                    var point = shapeStyle.pointList[i];
                    point[0] *= delta;
                    point[1] *= delta;
                }
                //If smoothness > 0
                var controlPointList = shapeStyle.controlPointList;
                if (controlPointList) {
                    for (var i = 0; i < controlPointList.length; i++) {
                        var point = controlPointList[i];
                        point[0] *= delta;
                        point[1] *= delta;
                    }
                }
            }

            function scaleMarkline(shapeStyle, delta) {
                shapeStyle.xStart *= delta;
                shapeStyle.yStart *= delta;
                shapeStyle.xEnd *= delta;
                shapeStyle.yEnd *= delta;
                if (shapeStyle.cpX1 != null) {
                    shapeStyle.cpX1 *= delta;
                    shapeStyle.cpY1 *= delta;
                }
            }

            var haveScale = false;
            for (mapType in mapTypeControl) {
                if (mapTypeControl[mapType]) {
                    haveScale = true;
                    var transform = this._mapDataMap[mapType].transform;
                    var left = transform.left;
                    var top = transform.top;
                    var width = transform.width;
                    var height = transform.height;
                    // 位置转经纬度
                    var geoAndPos = this.pos2geo(mapType, [mx - left, my - top]);
                    if (eventDelta > 0) {
                        delta = 1.2;        // 放大
                        if (this._scaleLimitMap[mapType].max != null
                            && transform.baseScale >= this._scaleLimitMap[mapType].max
                        ) {
                            continue;     // 缩放限制
                        }
                    }
                    else {
                        delta = 1 / 1.2;    // 缩小
                        if (this._scaleLimitMap[mapType].min != null
                            && transform.baseScale <= this._scaleLimitMap[mapType].min
                        ) {
                            continue;     // 缩放限制
                        }
                    }

                    transform.baseScale *= delta;
                    transform.scale.x *= delta;
                    transform.scale.y *= delta;
                    transform.width = width * delta;
                    transform.height = height * delta;

                    this._mapDataMap[mapType].hasRoam = true;
                    this._mapDataMap[mapType].transform = transform;
                    // 经纬度转位置
                    geoAndPos = this.geo2pos(mapType, geoAndPos);
                    // 保持视觉中心
                    transform.left -= geoAndPos[0] - (mx - left);
                    transform.top -= geoAndPos[1] - (my - top);
                    this._mapDataMap[mapType].transform = transform;

                    this.clearEffectShape(true);
                    for (var i = 0, l = this.shapeList.length; i < l; i++) {
                        var shape = this.shapeList[i];
                        if(shape._mapType == mapType) {
                            var shapeType = shape.type;
                            var shapeStyle = shape.style;
                            shape.position[0] = transform.left;
                            shape.position[1] = transform.top;

                            switch (shapeType) {
                                case 'path':
                                case 'symbol':
                                case 'circle':
                                case 'rectangle':
                                case 'polygon':
                                case 'line':
                                case 'ellipse':
                                case 'heatmap':
                                    shape.scale[0] *= delta;
                                    shape.scale[1] *= delta;
                                    break;
                                case 'mark-line':
                                    scaleMarkline(shapeStyle, delta);
                                    break;
                                case 'polyline':
                                    scalePolyline(shapeStyle, delta);
                                    break;
                                case 'shape-bundle':
                                    for (var j = 0; j < shapeStyle.shapeList.length; j++) {
                                        var subShape = shapeStyle.shapeList[j];
                                        if (subShape.type == 'mark-line') {
                                            scaleMarkline(subShape.style, delta);
                                        }
                                        else if (subShape.type == 'polyline') {
                                            scalePolyline(subShape.style, delta);
                                        }
                                    }
                                    break;
                                case 'icon':
                                case 'image':
                                    geoAndPos = this.geo2pos(mapType, shape._geo);
                                    shapeStyle.x = shapeStyle._x =
                                        geoAndPos[0] - shapeStyle.width / 2;
                                    shapeStyle.y = shapeStyle._y =
                                        geoAndPos[1] - shapeStyle.height / 2;
                                    break;
                                default:
                                    geoAndPos = this.geo2pos(mapType, shape._geo);
                                    shapeStyle.x = geoAndPos[0];
                                    shapeStyle.y = geoAndPos[1];
                                    if (shapeType == 'text') {
                                        shape._style.x = shape.highlightStyle.x
                                                                   = geoAndPos[0];
                                        shape._style.y = shape.highlightStyle.y
                                                                   = geoAndPos[1];
                                    }
                            }

                            this.zr.modShape(shape.id);
                        }
                    }
                }
            }
            if (haveScale) {
                zrEvent.stop(event);
                this.zr.refreshNextFrame();

                var self = this;
                clearTimeout(this._refreshDelayTicket);
                this._refreshDelayTicket = setTimeout(
                    function(){
                        self && self.shapeList && self.animationEffect();
                    },
                    100
                );

                this.messageCenter.dispatch(
                    ecConfig.EVENT.MAP_ROAM,
                    params.event,
                    {type : 'scale'},
                    this.myChart
                );
            }
        },

        __onmousedown : function (params) {
            if (this.shapeList.length <= 0) {
                return;
            }
            var target = params.target;
            if (target && target.draggable) {
                return;
            }
            var event = params.event;
            var mx = zrEvent.getX(event);
            var my = zrEvent.getY(event);
            var mapType = this._findMapTypeByPos(mx, my);
            if (mapType && this._roamMap[mapType] && this._roamMap[mapType] != 'scale') {
                this._mousedown = true;
                this._mx = mx;
                this._my = my;
                this._curMapType = mapType;
                this.zr.on(zrConfig.EVENT.MOUSEUP, this._onmouseup);
                var self = this;
                setTimeout(function (){
                    self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                },100);
            }

        },

        __onmousemove : function (params) {
            if (!this._mousedown || !this._isAlive) {
                return;
            }
            var event = params.event;
            var mx = zrEvent.getX(event);
            var my = zrEvent.getY(event);
            var transform = this._mapDataMap[this._curMapType].transform;
            transform.hasRoam = true;
            transform.left -= this._mx - mx;
            transform.top -= this._my - my;
            this._mx = mx;
            this._my = my;
            this._mapDataMap[this._curMapType].transform = transform;

            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                if(this.shapeList[i]._mapType == this._curMapType) {
                    this.shapeList[i].position[0] = transform.left;
                    this.shapeList[i].position[1] = transform.top;
                    this.zr.modShape(this.shapeList[i].id);
                }
            }

            this.messageCenter.dispatch(
                ecConfig.EVENT.MAP_ROAM,
                params.event,
                {type : 'move'},
                this.myChart
            );

            this.clearEffectShape(true);
            this.zr.refreshNextFrame();

            this._justMove = true;
            zrEvent.stop(event);
        },

        __onmouseup : function (params) {
            var event = params.event;
            this._mx = zrEvent.getX(event);
            this._my = zrEvent.getY(event);
            this._mousedown = false;
            var self = this;
            setTimeout(function (){
                self._justMove && self.animationEffect();
                self._justMove = false;
                self.zr.un(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                self.zr.un(zrConfig.EVENT.MOUSEUP, self._onmouseup);
            },120);
        },

        /**
         * 漫游组件事件响应
         */
        __onroamcontroller: function(params) {
            var event = params.event;
            event.zrenderX = this.zr.getWidth() / 2;
            event.zrenderY = this.zr.getHeight() / 2;
            var mapTypeControl = params.mapTypeControl;
            var top = 0;
            var left = 0;
            var step = params.step;

            switch(params.roamType) {
                case 'scaleUp':
                    event.zrenderDelta = 1;
                    this.__onmousewheel({
                        event: event,
                        mapTypeControl: mapTypeControl
                    });
                    return;
                case 'scaleDown':
                    event.zrenderDelta = -1;
                    this.__onmousewheel({
                        event: event,
                        mapTypeControl: mapTypeControl
                    });
                    return;
                case 'up':
                    top = -step;
                    break;
                case 'down':
                    top = step;
                    break;
                case 'left':
                    left = -step;
                    break;
                case 'right':
                    left = step;
                    break;
            }

            var transform;
            var curMapType;
            for (curMapType in mapTypeControl) {
                if (!this._mapDataMap[curMapType] || !this._activeMapType[curMapType]) {
                    continue;
                }
                transform = this._mapDataMap[curMapType].transform;
                transform.hasRoam = true;
                transform.left -= left;
                transform.top -= top;
                this._mapDataMap[curMapType].transform = transform;
            }
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                curMapType = this.shapeList[i]._mapType;
                if (!mapTypeControl[curMapType] || !this._activeMapType[curMapType]) {
                    continue;
                }
                transform = this._mapDataMap[curMapType].transform;
                this.shapeList[i].position[0] = transform.left;
                this.shapeList[i].position[1] = transform.top;
                this.zr.modShape(this.shapeList[i].id);
            }

            this.messageCenter.dispatch(
                ecConfig.EVENT.MAP_ROAM,
                params.event,
                {type : 'move'},
                this.myChart
            );

            this.clearEffectShape(true);
            this.zr.refreshNextFrame();

            clearTimeout(this.dircetionTimer);
            var self = this;
            this.dircetionTimer = setTimeout(function() {
                self.animationEffect();
            }, 150);
        },

        /**
         * dataRange hoverlink 事件响应
         */
        __ondrhoverlink : function(param) {
            var curMapType;
            var value;
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                curMapType = this.shapeList[i]._mapType;
                if (!this._hoverLinkMap[curMapType] || !this._activeMapType[curMapType]) {
                    continue;
                }
                value = ecData.get(this.shapeList[i], 'value');
                if (value != null && value >= param.valueMin && value <= param.valueMax) {
                    this.zr.addHoverShape(this.shapeList[i]);
                }
            }
        },

        /**
         * 点击响应
         */
        onclick : function (params) {
            if (!this.isClick || !params.target || this._justMove || params.target.type == 'icon') {
                // 没有在当前实例上发生点击直接返回
                return;
            }
            this.isClick = false;

            var target = params.target;
            var name = target.style._name;
            var len = this.shapeList.length;
            var mapType = target._mapType || '';

            if (this._selectedMode[mapType] == 'single') {
                for (var p in this._selected) {
                    // 同一地图类型
                    if (this._selected[p] && this._mapTypeMap[p] == mapType) {
                        // 复位那些生效shape（包括文字）
                        for (var i = 0; i < len; i++) {
                            if (this.shapeList[i].style._name == p
                                && this.shapeList[i]._mapType == mapType
                            ) {
                                this.shapeList[i].style = this.shapeList[i]._style;
                                this.zr.modShape(this.shapeList[i].id);
                            }
                        }
                        p != name && (this._selected[p] = false);
                    }
                }
            }

            this._selected[name] = !this._selected[name];

            // 更新当前点击shape（包括文字）
            for (var i = 0; i < len; i++) {
                if (this.shapeList[i].style._name == name
                    && this.shapeList[i]._mapType == mapType
                ) {
                   if (this._selected[name]) {
                        this.shapeList[i].style = this.shapeList[i].highlightStyle;
                    }
                    else {
                        this.shapeList[i].style = this.shapeList[i]._style;
                    }
                    this.zr.modShape(this.shapeList[i].id);
                }
            }
            this.messageCenter.dispatch(
                ecConfig.EVENT.MAP_SELECTED,
                params.event,
                {
                    selected : this._selected,
                    target : name
                },
                this.myChart
            );
            this.zr.refreshNextFrame();

            var self = this;
            setTimeout(function(){
                self.zr.trigger(
                    zrConfig.EVENT.MOUSEMOVE,
                    params.event
                );
            },100);
        },

        /**
         * 刷新
         */
        refresh : function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }

            if (this._mapDataRequireCounter > 0) {
                this.clear();
            }
            else {
                this.backupShapeList();
            }
            this._buildShape();
            this.zr.refreshHover();
        },

        /**
         * 值域响应
         * @param {Object} param
         * @param {Object} status
         */
        ondataRange : function (param, status) {
            if (this.component.dataRange) {
                this.refresh();
                status.needRefresh = true;
            }
            return;
        },

        /**
         * 平面坐标转经纬度
         */
        pos2geo : function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            return this._mapDataMap[mapType].projection.pos2geo(
                this._mapDataMap[mapType].transform, p
            );
        },

        /**
         * 公开接口 : 平面坐标转经纬度
         */
        getGeoByPos : function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            var position = [
                this._mapDataMap[mapType].transform.left,
                this._mapDataMap[mapType].transform.top
            ];
            if (p instanceof Array) {
                p[0] -= position[0];
                p[1] -= position[1];
            }
            else {
                p.x -= position[0];
                p.y -= position[1];
            }
            return this.pos2geo(mapType, p);
        },

        /**
         * 经纬度转平面坐标
         * @param {Object} p
         */
        geo2pos : function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            return this._mapDataMap[mapType].projection.geo2pos(
                this._mapDataMap[mapType].transform, p
            );
        },

        /**
         * 公开接口 : 经纬度转平面坐标
         */
        getPosByGeo : function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            var pos = this.geo2pos(mapType, p);
            pos[0] += this._mapDataMap[mapType].transform.left;
            pos[1] += this._mapDataMap[mapType].transform.top;
            return pos;
        },

        /**
         * 公开接口 : 地图参考坐标
         */
        getMapPosition : function (mapType) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            return [
                this._mapDataMap[mapType].transform.left,
                this._mapDataMap[mapType].transform.top
            ];
        },

        /*
        appendShape : function (mapType, shapeList) {
            shapeList = shapeList instanceof Array
                        ? shapeList : [shapeList];
            for (var i = 0, l = shapeList.length; i < l; i++) {
                if (typeof shapeList[i].zlevel == 'undefined') {
                    shapeList[i].zlevel = this.getZlevelBase();
                    shapeList[i].z = this.getZBase() + 1;
                }
                shapeList[i]._mapType = mapType;
                this.shapeList.push(shapeList[i]);
                this.zr.addShape(shapeList[i]);
            }
            this.zr.refresh();
        },
        */

        /**
         * 释放后实例不可用
         */
        onbeforDispose : function () {
            this._isAlive = false;
            this.zr.un(zrConfig.EVENT.MOUSEWHEEL, this._onmousewheel);
            this.zr.un(zrConfig.EVENT.MOUSEDOWN, this._onmousedown);
            this.messageCenter.unbind(
                ecConfig.EVENT.ROAMCONTROLLER, this._onroamcontroller
            );
            this.messageCenter.unbind(
                ecConfig.EVENT.DATA_RANGE_HOVERLINK, this._ondrhoverlink
            );
        }
    };

    zrUtil.inherits(Map, ChartBase);

    // 图表注册
    require('../chart').define('map', Map);

    return Map;
});