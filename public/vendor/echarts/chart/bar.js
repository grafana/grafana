<<<<<<< 69731ad64d6739e64bddf8f0ed4807f151d3c0c8
<<<<<<< d2990b60ec74138d9a51007b47efbcb10200a2cf
=======
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
>>>>>>> [OWL-30] Add Echarts map to Grafana
/**
 * echarts图表类：柱形图
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var ChartBase = require('./base');
    
    // 图形依赖
    var RectangleShape = require('zrender/shape/Rectangle');
    // 组件依赖
    require('../component/axis');
    require('../component/grid');
    require('../component/dataZoom');
    
    var ecConfig = require('../config');
    // 柱形图默认参数
    ecConfig.bar = {
        zlevel: 0,                  // 一级层叠
        z: 2,                       // 二级层叠
        clickable: true,
        legendHoverLink: true,
        // stack: null
        xAxisIndex: 0,
        yAxisIndex: 0,
        barMinHeight: 0,          // 最小高度改为0
        // barWidth: null,        // 默认自适应
        barGap: '30%',            // 柱间距离，默认为柱形宽度的30%，可设固定值
        barCategoryGap: '20%',    // 类目间柱形距离，默认为类目间距的20%，可设固定值
        itemStyle: {
            normal: {
                // color: '各异',
                barBorderColor: '#fff',       // 柱条边线
                barBorderRadius: 0,           // 柱条边线圆角，单位px，默认为0
                barBorderWidth: 0,            // 柱条边线线宽，单位px，默认为1
                label: {
                    show: false
                    // formatter: 标签文本格式器，同Tooltip.formatter，不支持异步回调
                    // position: 默认自适应，水平布局为'top'，垂直布局为'right'，可选为
                    //           'inside'|'left'|'right'|'top'|'bottom'
                    // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                }
            },
            emphasis: {
                // color: '各异',
                barBorderColor: '#fff',            // 柱条边线
                barBorderRadius: 0,                // 柱条边线圆角，单位px，默认为0
                barBorderWidth: 0,                 // 柱条边线线宽，单位px，默认为1
                label: {
                    show: false
                    // formatter: 标签文本格式器，同Tooltip.formatter，不支持异步回调
                    // position: 默认自适应，水平布局为'top'，垂直布局为'right'，可选为
                    //           'inside'|'left'|'right'|'top'|'bottom'
                    // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                }
            }
        }
    };

    var ecData = require('../util/ecData');
    var zrUtil = require('zrender/tool/util');
    var zrColor = require('zrender/tool/color');
    
    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} series 数据
     * @param {Object} component 组件
     */
    function Bar(ecTheme, messageCenter, zr, option, myChart){
        // 图表基类
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);
        
        this.refresh(option);
    }
    
    Bar.prototype = {
        type: ecConfig.CHART_TYPE_BAR,
        /**
         * 绘制图形
         */
        _buildShape: function () {
            this._buildPosition();
        },
        
        _buildNormal: function(seriesArray, maxDataLength, locationMap, xMarkMap, orient) {
            var series = this.series;
            // 确定类目轴和数值轴，同一方向随便找一个即可
            var seriesIndex = locationMap[0][0];
            var serie = series[seriesIndex];
            var isHorizontal = orient == 'horizontal';
            var xAxis = this.component.xAxis;
            var yAxis = this.component.yAxis;
            var categoryAxis = isHorizontal 
                               ? xAxis.getAxis(serie.xAxisIndex)
                               : yAxis.getAxis(serie.yAxisIndex);
            var valueAxis;  // 数值轴各异

            var size = this._mapSize(categoryAxis, locationMap);
            var gap = size.gap;
            var barGap = size.barGap;
            var barWidthMap = size.barWidthMap;
            var barMaxWidthMap = size.barMaxWidthMap;
            var barWidth = size.barWidth;                   // 自适应宽度
            var barMinHeightMap = size.barMinHeightMap;
            var barHeight;
            var curBarWidth;
            var interval = size.interval;

            var x;
            var y;
            var lastP; // 正向堆积处理
            var baseP;
            var lastN; // 负向堆积处理
            var baseN;
            var barShape;
            var data;
            var value;
            var islandR = this.deepQuery([this.ecTheme, ecConfig], 'island.r');
            for (var i = 0, l = maxDataLength; i < l; i++) {
                if (categoryAxis.getNameByIndex(i) == null) {
                    // 系列数据超出类目轴长度
                    break;
                }
                isHorizontal
                    ? (x = categoryAxis.getCoordByIndex(i) - gap / 2)
                    : (y = categoryAxis.getCoordByIndex(i) + gap / 2);

                for (var j = 0, k = locationMap.length; j < k; j++) {
                    // 堆积数据用第一条valueAxis
                    var yAxisIndex = series[locationMap[j][0]].yAxisIndex || 0;
                    var xAxisIndex = series[locationMap[j][0]].xAxisIndex || 0;
                    valueAxis = isHorizontal 
                                ? yAxis.getAxis(yAxisIndex)
                                : xAxis.getAxis(xAxisIndex);
                    baseP = lastP = baseN = lastN = valueAxis.getCoord(0);
                    for (var m = 0, n = locationMap[j].length; m < n; m++) {
                        seriesIndex = locationMap[j][m];
                        serie = series[seriesIndex];
                        data = serie.data[i];
                        value = this.getDataFromOption(data, '-');
                        xMarkMap[seriesIndex] = xMarkMap[seriesIndex] 
                                                || {
                                                    min: Number.POSITIVE_INFINITY,
                                                    max: Number.NEGATIVE_INFINITY,
                                                    sum: 0,
                                                    counter: 0,
                                                    average: 0
                                                };
                        curBarWidth = Math.min(
                            barMaxWidthMap[seriesIndex] || Number.MAX_VALUE,
                            barWidthMap[seriesIndex] || barWidth
                        );
                        if (value === '-') {
                            // 空数据在做完后补充拖拽提示框
                            continue;
                        }
                        if (value > 0) {
                            // 正向堆积
                            barHeight = m > 0 
                                        ? valueAxis.getCoordSize(value)
                                        : (
                                            isHorizontal
                                            ? (baseP - valueAxis.getCoord(value))
                                            : (valueAxis.getCoord(value) - baseP)
                                        );
                            // 非堆积数据最小高度有效
                            if (n === 1 && barMinHeightMap[seriesIndex] > barHeight) {
                                barHeight = barMinHeightMap[seriesIndex];
                            }
                            if (isHorizontal) {
                                lastP -= barHeight;
                                y = lastP;
                            }
                            else {
                                x = lastP;
                                lastP += barHeight;
                            }
                        }
                        else if (value < 0){
                            // 负向堆积
                            barHeight = m > 0 
                                        ? valueAxis.getCoordSize(value)
                                        : (
                                            isHorizontal
                                            ? (valueAxis.getCoord(value) - baseN)
                                            : (baseN - valueAxis.getCoord(value))
                                        );
                            // 非堆积数据最小高度有效
                            if (n === 1 && barMinHeightMap[seriesIndex] > barHeight) {
                                barHeight = barMinHeightMap[seriesIndex];
                            }
                            if (isHorizontal) {
                                y = lastN;
                                lastN += barHeight;
                            }
                            else {
                                lastN -= barHeight;
                                x = lastN;
                            }
                        }
                        else {
                            // 0值
                            barHeight = 0;
                            // 最小高度无效
                            if (isHorizontal) {
                                lastP -= barHeight;
                                y = lastP;
                            }
                            else {
                                x = lastP;
                                lastP += barHeight;
                            }
                        }
                        xMarkMap[seriesIndex][i] = isHorizontal
                                                   ? (x + curBarWidth / 2) 
                                                   : (y - curBarWidth / 2);
                        if (xMarkMap[seriesIndex].min > value) {
                            xMarkMap[seriesIndex].min = value;
                            if (isHorizontal) {
                                xMarkMap[seriesIndex].minY = y;
                                xMarkMap[seriesIndex].minX = xMarkMap[seriesIndex][i];
                            }
                            else {
                                xMarkMap[seriesIndex].minX = x + barHeight;
                                xMarkMap[seriesIndex].minY = xMarkMap[seriesIndex][i];
                            }
                        }
                        if (xMarkMap[seriesIndex].max < value) {
                            xMarkMap[seriesIndex].max = value;
                            if (isHorizontal) {
                                xMarkMap[seriesIndex].maxY = y;
                                xMarkMap[seriesIndex].maxX = xMarkMap[seriesIndex][i];
                            }
                            else {
                                xMarkMap[seriesIndex].maxX = x + barHeight;
                                xMarkMap[seriesIndex].maxY = xMarkMap[seriesIndex][i];
                            }
                            
                        }
                        xMarkMap[seriesIndex].sum += value;
                        xMarkMap[seriesIndex].counter++;
                        
                        if (i % interval === 0) {
                            barShape = this._getBarItem(
                                seriesIndex, i,
                                categoryAxis.getNameByIndex(i),
                                x,
                                y - (isHorizontal ? 0 : curBarWidth),
                                isHorizontal ? curBarWidth : barHeight,
                                isHorizontal ? barHeight : curBarWidth,
                                isHorizontal ? 'vertical' : 'horizontal'
                            );
                            this.shapeList.push(new RectangleShape(barShape));
                        }
                    }

                    // 补充空数据的拖拽提示框
                    for (var m = 0, n = locationMap[j].length; m < n; m++) {
                        seriesIndex = locationMap[j][m];
                        serie = series[seriesIndex];
                        data = serie.data[i];
                        value = this.getDataFromOption(data, '-');
                        curBarWidth = Math.min(
                            barMaxWidthMap[seriesIndex] || Number.MAX_VALUE,
                            barWidthMap[seriesIndex] || barWidth
                        );
                        if (value != '-') {
                            // 只关心空数据
                            continue;
                        }

                        if (this.deepQuery([data, serie, this.option], 'calculable')) {
                            if (isHorizontal) {
                                lastP -= islandR;
                                y = lastP;
                            }
                            else {
                                x = lastP;
                                lastP += islandR;
                            }
                            
                            barShape = this._getBarItem(
                                seriesIndex, i,
                                categoryAxis.getNameByIndex(i),
                                x,
                                y - (isHorizontal ? 0 : curBarWidth),
                                isHorizontal ? curBarWidth : islandR,
                                isHorizontal ? islandR : curBarWidth,
                                isHorizontal ? 'vertical' : 'horizontal'
                            );
                            barShape.hoverable = false;
                            barShape.draggable = false;
                            barShape.style.lineWidth = 1;
                            barShape.style.brushType = 'stroke';
                            barShape.style.strokeColor = serie.calculableHolderColor
                                                         || this.ecTheme.calculableHolderColor
                                                         || ecConfig.calculableHolderColor;

                            this.shapeList.push(new RectangleShape(barShape));
                        }
                    }
                    isHorizontal
                        ? (x += (curBarWidth + barGap))
                        : (y -= (curBarWidth + barGap));
                }
            }
            
            this._calculMarkMapXY(xMarkMap, locationMap, isHorizontal ? 'y' : 'x');
        },
        /**
         * 构建类目轴为水平方向的柱形图系列
         */
        _buildHorizontal: function (seriesArray, maxDataLength, locationMap, xMarkMap) {
            return this._buildNormal(
                seriesArray, maxDataLength, locationMap, xMarkMap, 'horizontal'
            );
        },

        /**
         * 构建类目轴为垂直方向的柱形图系列
         */
        _buildVertical: function (seriesArray, maxDataLength, locationMap, xMarkMap) {
            return this._buildNormal(
                seriesArray, maxDataLength, locationMap, xMarkMap, 'vertical'
            );
        },
        
        /**
         * 构建双数值轴柱形图
         */
        _buildOther: function (seriesArray, maxDataLength, locationMap, xMarkMap) {
            var series = this.series;
            
            for (var j = 0, k = locationMap.length; j < k; j++) {
                for (var m = 0, n = locationMap[j].length; m < n; m++) {
                    var seriesIndex = locationMap[j][m];
                    var serie = series[seriesIndex];
                    var xAxisIndex = serie.xAxisIndex || 0;
                    var xAxis = this.component.xAxis.getAxis(xAxisIndex);
                    var baseX = xAxis.getCoord(0);
                    var yAxisIndex = serie.yAxisIndex || 0;
                    var yAxis = this.component.yAxis.getAxis(yAxisIndex);
                    var baseY = yAxis.getCoord(0);
                    
                    xMarkMap[seriesIndex] = xMarkMap[seriesIndex] 
                                            || {
                                                min0: Number.POSITIVE_INFINITY,
                                                min1: Number.POSITIVE_INFINITY,
                                                max0: Number.NEGATIVE_INFINITY,
                                                max1: Number.NEGATIVE_INFINITY,
                                                sum0: 0,
                                                sum1: 0,
                                                counter0: 0,
                                                counter1: 0,
                                                average0: 0,
                                                average1: 0
                                            };

                    for (var i = 0, l = serie.data.length; i < l; i++) {
                        var data = serie.data[i];
                        var value = this.getDataFromOption(data, '-');
                        if (!(value instanceof Array)) {
                            continue;
                        }
                        
                        var x = xAxis.getCoord(value[0]);
                        var y = yAxis.getCoord(value[1]);
                        
                        var queryTarget = [data, serie];
                        var barWidth = this.deepQuery(queryTarget, 'barWidth') || 10; // 默认柱形
                        var barHeight = this.deepQuery(queryTarget, 'barHeight');
                        var orient;
                        var barShape;
                        
                        if (barHeight != null) {
                            // 条形图
                            orient = 'horizontal';
                            
                            if (value[0] > 0) {
                                // 正向
                                barWidth = x - baseX;
                                x -= barWidth;
                            }
                            else if (value[0] < 0){
                                // 负向
                                barWidth = baseX - x;
                            }
                            else {
                                // 0值
                                barWidth = 0;
                            }
                            
                            barShape = this._getBarItem(
                                seriesIndex, i,
                                value[0],
                                x, 
                                y - barHeight / 2,
                                barWidth,
                                barHeight,
                                orient
                            );
                        }
                        else {
                            // 柱形
                            orient = 'vertical';
                            
                            if (value[1] > 0) {
                            // 正向
                                barHeight = baseY - y;
                            }
                            else if (value[1] < 0){
                                // 负向
                                barHeight = y - baseY;
                                y -= barHeight;
                            }
                            else {
                                // 0值
                                barHeight = 0;
                            }
                            barShape = this._getBarItem(
                                seriesIndex, i,
                                value[0],
                                x - barWidth / 2, 
                                y,
                                barWidth,
                                barHeight,
                                orient
                            );
                        }
                        this.shapeList.push(new RectangleShape(barShape));
                        
                        
                        x = xAxis.getCoord(value[0]);
                        y = yAxis.getCoord(value[1]);
                        if (xMarkMap[seriesIndex].min0 > value[0]) {
                            xMarkMap[seriesIndex].min0 = value[0];
                            xMarkMap[seriesIndex].minY0 = y;
                            xMarkMap[seriesIndex].minX0 = x;
                        }
                        if (xMarkMap[seriesIndex].max0 < value[0]) {
                            xMarkMap[seriesIndex].max0 = value[0];
                            xMarkMap[seriesIndex].maxY0 = y;
                            xMarkMap[seriesIndex].maxX0 = x;
                        }
                        xMarkMap[seriesIndex].sum0 += value[0];
                        xMarkMap[seriesIndex].counter0++;
                        
                        if (xMarkMap[seriesIndex].min1 > value[1]) {
                            xMarkMap[seriesIndex].min1 = value[1];
                            xMarkMap[seriesIndex].minY1 = y;
                            xMarkMap[seriesIndex].minX1 = x;
                        }
                        if (xMarkMap[seriesIndex].max1 < value[1]) {
                            xMarkMap[seriesIndex].max1 = value[1];
                            xMarkMap[seriesIndex].maxY1 = y;
                            xMarkMap[seriesIndex].maxX1 = x;
                        }
                        xMarkMap[seriesIndex].sum1 += value[1];
                        xMarkMap[seriesIndex].counter1++;
                    }
                }
            }
            
            this._calculMarkMapXY(xMarkMap, locationMap, 'xy');
        },
        
        /**
         * 我真是自找麻烦啊，为啥要允许系列级个性化最小宽度和高度啊！！！
         * @param {CategoryAxis} categoryAxis 类目坐标轴，需要知道类目间隔大小
         * @param {Array} locationMap 整形数据的系列索引
         */
        _mapSize: function (categoryAxis, locationMap, ignoreUserDefined) {
            var res = this._findSpecialBarSzie(locationMap, ignoreUserDefined);
            var barWidthMap = res.barWidthMap;
            var barMaxWidthMap = res.barMaxWidthMap;
            var barMinHeightMap = res.barMinHeightMap;
            var sBarWidthCounter = res.sBarWidthCounter;    // 用户指定
            var sBarWidthTotal = res.sBarWidthTotal;        // 用户指定
            var barGap = res.barGap;
            var barCategoryGap = res.barCategoryGap;
            
            var gap;
            var barWidth;
            var interval = 1;
            if (locationMap.length != sBarWidthCounter) {
                // 至少存在一个自适应宽度的柱形图
                if (!ignoreUserDefined) {
                    gap = typeof barCategoryGap === 'string' && barCategoryGap.match(/%$/)
                          // 百分比
                          ? ((categoryAxis.getGap() * (100 - parseFloat(barCategoryGap)) / 100).toFixed(2) - 0)
                          // 数值
                          : (categoryAxis.getGap() - barCategoryGap);
                    if (typeof barGap === 'string' && barGap.match(/%$/)) {
                        barGap = parseFloat(barGap) / 100;
                        barWidth = +(
                            (gap - sBarWidthTotal) / (
                                (locationMap.length - 1) * barGap + locationMap.length - sBarWidthCounter
                            )
                        ).toFixed(2);
                        barGap = barWidth * barGap;
                    }
                    else {
                        barGap = parseFloat(barGap);
                        barWidth = +(
                            (gap - sBarWidthTotal - barGap * (locationMap.length - 1)) / (
                                locationMap.length - sBarWidthCounter
                            )
                        ).toFixed(2);
                    }
                    // 无法满足用户定义的宽度设计，忽略用户宽度，打回重做
                    if (barWidth <= 0) {
                        return this._mapSize(categoryAxis, locationMap, true);
                    }
                }
                else {
                    // 忽略用户定义的宽度设定
                    gap = categoryAxis.getGap();
                    barGap = 0;
                    barWidth = +(gap / locationMap.length).toFixed(2);
                    // 已经忽略用户定义的宽度设定依然还无法满足显示，只能硬来了;
                    if (barWidth <= 0) {
                        interval = Math.floor(locationMap.length / gap);
                        barWidth = 1;
                    }
                }
            }
            else {
                // 全是自定义宽度，barGap无效，系列间隔决定barGap
                gap = sBarWidthCounter > 1
                      ? (typeof barCategoryGap === 'string' && barCategoryGap.match(/%$/))
                          // 百分比
                          ? +(categoryAxis.getGap() * (100 - parseFloat(barCategoryGap)) / 100).toFixed(2)
                          // 数值
                          : (categoryAxis.getGap() - barCategoryGap)
                      // 只有一个
                      : sBarWidthTotal;
                barWidth = 0;
                barGap = sBarWidthCounter > 1 
                         ? +((gap - sBarWidthTotal) / (sBarWidthCounter - 1)).toFixed(2)
                         : 0;
                if (barGap < 0) {
                    // 无法满足用户定义的宽度设计，忽略用户宽度，打回重做
                    return this._mapSize(categoryAxis, locationMap, true);
                }
            }
            
            // 检查是否满足barMaxWidthMap
            
            return this._recheckBarMaxWidth(
                locationMap,
                barWidthMap, barMaxWidthMap, barMinHeightMap,
                gap,   // 总宽度
                barWidth, barGap, interval
            );
        },
        
        /**
         * 计算堆积下用户特殊指定的各种size 
         */
        _findSpecialBarSzie: function(locationMap, ignoreUserDefined) {
            var series = this.series;
            var barWidthMap = {};
            var barMaxWidthMap = {};
            var barMinHeightMap = {};
            var sBarWidth;              // 用户指定
            var sBarMaxWidth;           // 用户指定
            var sBarWidthCounter = 0;   // 用户指定
            var sBarWidthTotal = 0;     // 用户指定
            var barGap;
            var barCategoryGap;
            for (var j = 0, k = locationMap.length; j < k; j++) {
                var hasFound = {
                    barWidth: false,
                    barMaxWidth: false
                };
                for (var m = 0, n = locationMap[j].length; m < n; m++) {
                    var seriesIndex = locationMap[j][m];
                    var queryTarget = series[seriesIndex];
                    if (!ignoreUserDefined) {
                        if (!hasFound.barWidth) {
                            sBarWidth = this.query(queryTarget, 'barWidth');
                            if (sBarWidth != null) {
                                // 同一堆积第一个生效barWidth
                                barWidthMap[seriesIndex] = sBarWidth;
                                sBarWidthTotal += sBarWidth;
                                sBarWidthCounter++;
                                hasFound.barWidth = true;
                                // 复位前面同一堆积但没被定义的
                                for (var ii = 0, ll = m; ii < ll; ii++) {
                                    var pSeriesIndex = locationMap[j][ii];
                                    barWidthMap[pSeriesIndex] = sBarWidth;
                                }
                            }
                        }
                        else {
                            barWidthMap[seriesIndex] = sBarWidth;   // 用找到的一个
                        }
                        
                        if (!hasFound.barMaxWidth) {
                            sBarMaxWidth = this.query(queryTarget, 'barMaxWidth');
                            if (sBarMaxWidth != null) {
                                // 同一堆积第一个生效barMaxWidth
                                barMaxWidthMap[seriesIndex] = sBarMaxWidth;
                                hasFound.barMaxWidth = true;
                                // 复位前面同一堆积但没被定义的
                                for (var ii = 0, ll = m; ii < ll; ii++) {
                                    var pSeriesIndex = locationMap[j][ii];
                                    barMaxWidthMap[pSeriesIndex] = sBarMaxWidth;
                                }
                            }
                        }
                        else {
                            barMaxWidthMap[seriesIndex] = sBarMaxWidth;   // 用找到的一个
                        }
                    }

                    barMinHeightMap[seriesIndex] = this.query(queryTarget, 'barMinHeight');
                    barGap = barGap != null ? barGap : this.query(queryTarget, 'barGap');
                    barCategoryGap = barCategoryGap != null 
                                     ? barCategoryGap : this.query(queryTarget, 'barCategoryGap');
                }
            }
            
            return {
                barWidthMap: barWidthMap,
                barMaxWidthMap: barMaxWidthMap,
                barMinHeightMap: barMinHeightMap,
                sBarWidth: sBarWidth,
                sBarMaxWidth: sBarMaxWidth,
                sBarWidthCounter: sBarWidthCounter,
                sBarWidthTotal: sBarWidthTotal,
                barGap: barGap,
                barCategoryGap: barCategoryGap
            };
        },
        
        /**
         * 检查是否满足barMaxWidthMap 
         */
        _recheckBarMaxWidth: function(
                locationMap,
                barWidthMap, barMaxWidthMap, barMinHeightMap,
                gap,   // 总宽度
                barWidth, barGap, interval
        ) {
            for (var j = 0, k = locationMap.length; j < k; j++) {
                var seriesIndex = locationMap[j][0];
                if (barMaxWidthMap[seriesIndex] && barMaxWidthMap[seriesIndex] < barWidth) {
                    // 不满足最大宽度
                    gap -= barWidth - barMaxWidthMap[seriesIndex]; // 总宽度减少
                }
            }
            
            return {
                barWidthMap: barWidthMap,
                barMaxWidthMap: barMaxWidthMap,
                barMinHeightMap: barMinHeightMap ,
                gap: gap,   // 总宽度
                barWidth: barWidth,
                barGap: barGap,
                interval: interval
            };
        },
        
        /**
         * 生成最终图形数据
         */
        _getBarItem: function (seriesIndex, dataIndex, name, x, y, width, height, orient) {
            var series = this.series;
            var barShape;
            var serie = series[seriesIndex];
            var data = serie.data[dataIndex];
            // 多级控制
            var defaultColor = this._sIndex2ColorMap[seriesIndex];
            var queryTarget = [data, serie];
            
            var normal = this.deepMerge(queryTarget, 'itemStyle.normal');
            var emphasis = this.deepMerge(queryTarget, 'itemStyle.emphasis');
            var normalBorderWidth = normal.barBorderWidth;
            
            barShape = {
                zlevel: serie.zlevel,
                z: serie.z,
                clickable: this.deepQuery(queryTarget, 'clickable'),
                style: {
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    brushType: 'both',
                    color: this.getItemStyleColor(
                        this.deepQuery(queryTarget, 'itemStyle.normal.color') || defaultColor,
                        seriesIndex, dataIndex, data
                    ),
                    radius: normal.barBorderRadius,
                    lineWidth: normalBorderWidth,
                    strokeColor: normal.barBorderColor
                },
                highlightStyle: {
                    color: this.getItemStyleColor(
                        this.deepQuery(queryTarget, 'itemStyle.emphasis.color'),
                        seriesIndex, dataIndex, data
                    ),
                    radius: emphasis.barBorderRadius,
                    lineWidth: emphasis.barBorderWidth,
                    strokeColor: emphasis.barBorderColor
                },
                _orient: orient
            };
            var barShapeStyle = barShape.style;
            barShape.highlightStyle.color = barShape.highlightStyle.color
                            || (typeof barShapeStyle.color === 'string'
                                ? zrColor.lift(barShapeStyle.color, -0.3)
                                : barShapeStyle.color
                               );
            //亚像素优化
            barShapeStyle.x = Math.floor(barShapeStyle.x);
            barShapeStyle.y = Math.floor(barShapeStyle.y);
            barShapeStyle.height = Math.ceil(barShapeStyle.height);
            barShapeStyle.width = Math.ceil(barShapeStyle.width);
            // 考虑线宽的显示优化
            if (normalBorderWidth > 0
                && barShapeStyle.height > normalBorderWidth
                && barShapeStyle.width > normalBorderWidth
            ) {
                barShapeStyle.y += normalBorderWidth / 2;
                barShapeStyle.height -= normalBorderWidth;
                barShapeStyle.x += normalBorderWidth / 2;
                barShapeStyle.width -= normalBorderWidth;
            }
            else {
                // 太小了或者线宽小于0，废了边线
                barShapeStyle.brushType = 'fill';
            }
            
            barShape.highlightStyle.textColor = barShape.highlightStyle.color;
            
            barShape = this.addLabel(barShape, serie, data, name, orient);
            var barShapeStyleList = [                    // normal emphasis都需要检查
                barShapeStyle,
                barShape.highlightStyle
            ];
            for (var i = 0, l = barShapeStyleList.length; i < l; i++) {
                var textPosition = barShapeStyleList[i].textPosition;
                if (textPosition === 'insideLeft'
                    || textPosition === 'insideRight'
                    || textPosition === 'insideTop'
                    || textPosition === 'insideBottom'
                ) {
                    var gap = 5;
                    switch (textPosition) {
                        case 'insideLeft':
                            barShapeStyleList[i].textX = barShapeStyle.x + gap;
                            barShapeStyleList[i].textY = barShapeStyle.y + barShapeStyle.height / 2;
                            barShapeStyleList[i].textAlign = 'left';
                            barShapeStyleList[i].textBaseline = 'middle';
                            break;
                        case 'insideRight':
                            barShapeStyleList[i].textX = barShapeStyle.x + barShapeStyle.width - gap;
                            barShapeStyleList[i].textY = barShapeStyle.y + barShapeStyle.height / 2;
                            barShapeStyleList[i].textAlign = 'right';
                            barShapeStyleList[i].textBaseline = 'middle';
                            break;
                        case 'insideTop':
                            barShapeStyleList[i].textX = barShapeStyle.x + barShapeStyle.width / 2;
                            barShapeStyleList[i].textY = barShapeStyle.y + gap / 2;
                            barShapeStyleList[i].textAlign = 'center';
                            barShapeStyleList[i].textBaseline = 'top';
                            break;
                        case 'insideBottom':
                            barShapeStyleList[i].textX = barShapeStyle.x + barShapeStyle.width / 2;
                            barShapeStyleList[i].textY = barShapeStyle.y + barShapeStyle.height - gap / 2;
                            barShapeStyleList[i].textAlign = 'center';
                            barShapeStyleList[i].textBaseline = 'bottom';
                            break;
                    }
                    barShapeStyleList[i].textPosition = 'specific';
                    barShapeStyleList[i].textColor = barShapeStyleList[i].textColor || '#fff';
                }
            }
            

            if (this.deepQuery([data, serie, this.option],'calculable')) {
                this.setCalculable(barShape);
                barShape.draggable = true;
            }

            ecData.pack(
                barShape,
                series[seriesIndex], seriesIndex,
                series[seriesIndex].data[dataIndex], dataIndex,
                name
            );

            return barShape;
        },

        // 位置转换
        getMarkCoord: function (seriesIndex, mpData) {
            var serie = this.series[seriesIndex];
            var xMarkMap = this.xMarkMap[seriesIndex];
            var xAxis = this.component.xAxis.getAxis(serie.xAxisIndex);
            var yAxis = this.component.yAxis.getAxis(serie.yAxisIndex);
            var dataIndex;
            var pos;
            if (mpData.type
                && (mpData.type === 'max' || mpData.type === 'min' || mpData.type === 'average')
            ) {
                // 特殊值内置支持
                var valueIndex = mpData.valueIndex != null 
                                 ? mpData.valueIndex 
                                 : xMarkMap.maxX0 != null 
                                   ? '1' : '';
                pos = [
                    xMarkMap[mpData.type + 'X' + valueIndex],
                    xMarkMap[mpData.type + 'Y' + valueIndex],
                    xMarkMap[mpData.type + 'Line' + valueIndex],
                    xMarkMap[mpData.type + valueIndex]
                ];
            }
            else if (xMarkMap.isHorizontal) {
                // 横向
                dataIndex = typeof mpData.xAxis === 'string' && xAxis.getIndexByName
                            ? xAxis.getIndexByName(mpData.xAxis)
                            : (mpData.xAxis || 0);
                
                var x = xMarkMap[dataIndex];
                x = x != null
                    ? x 
                    : typeof mpData.xAxis != 'string' && xAxis.getCoordByIndex
                      ? xAxis.getCoordByIndex(mpData.xAxis || 0)
                      : xAxis.getCoord(mpData.xAxis || 0);
                
                pos = [x, yAxis.getCoord(mpData.yAxis || 0)];
            }
            else {
                // 纵向
                dataIndex = typeof mpData.yAxis === 'string' && yAxis.getIndexByName
                            ? yAxis.getIndexByName(mpData.yAxis)
                            : (mpData.yAxis || 0);
                
                var y = xMarkMap[dataIndex];
                y = y != null
                    ? y
                    : typeof mpData.yAxis != 'string' && yAxis.getCoordByIndex
                      ? yAxis.getCoordByIndex(mpData.yAxis || 0)
                      : yAxis.getCoord(mpData.yAxis || 0);
                
                pos = [xAxis.getCoord(mpData.xAxis || 0), y];
            }
            
            return pos;
        },
        
        /**
         * 刷新
         */
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }
            
            this.backupShapeList();
            this._buildShape();
        },
        
        /**
         * 动态数据增加动画 
         */
        addDataAnimation: function (params, done) {
            var series = this.series;
            var aniMap = {}; // seriesIndex索引参数
            for (var i = 0, l = params.length; i < l; i++) {
                aniMap[params[i][0]] = params[i];
            }
            var x;
            var dx;
            var y;
            var dy;
            var serie;
            var seriesIndex;
            var dataIndex;

            var aniCount = 0;
            function animationDone() {
                aniCount--;
                if (aniCount === 0) {
                    done && done();
                }
            }
            for (var i = this.shapeList.length - 1; i >= 0; i--) {
                seriesIndex = ecData.get(this.shapeList[i], 'seriesIndex');
                if (aniMap[seriesIndex] && !aniMap[seriesIndex][3]) {
                    // 有数据删除才有移动的动画
                    if (this.shapeList[i].type === 'rectangle') {
                        // 主动画
                        dataIndex = ecData.get(this.shapeList[i], 'dataIndex');
                        serie = series[seriesIndex];
                        if (aniMap[seriesIndex][2] && dataIndex === serie.data.length - 1) {
                            // 队头加入删除末尾
                            this.zr.delShape(this.shapeList[i].id);
                            continue;
                        }
                        else if (!aniMap[seriesIndex][2] && dataIndex === 0) {
                            // 队尾加入删除头部
                            this.zr.delShape(this.shapeList[i].id);
                            continue;
                        }
                        if (this.shapeList[i]._orient === 'horizontal') {
                            // 条形图
                            dy = this.component.yAxis.getAxis(serie.yAxisIndex || 0).getGap();
                            y = aniMap[seriesIndex][2] ? -dy : dy;
                            x = 0;
                        }
                        else {
                            // 柱形图
                            dx = this.component.xAxis.getAxis(serie.xAxisIndex || 0).getGap();
                            x = aniMap[seriesIndex][2] ? dx : -dx;
                            y = 0;
                        }
                        this.shapeList[i].position = [0, 0];

                        aniCount++;
                        this.zr.animate(this.shapeList[i].id, '')
                            .when(
                                this.query(this.option, 'animationDurationUpdate'),
                                { position: [x, y] }
                            )
                            .done(animationDone)
                            .start();
                    }
                }
            }
            
            // 没有动画
            if (!aniCount) {
                done && done();
            }
        }
    };
    
    zrUtil.inherits(Bar, ChartBase);
    
    // 图表注册
    require('../chart').define('bar', Bar);
    
    return Bar;
});
=======
define("echarts/chart/bar",["require","./base","zrender/shape/Rectangle","../component/axis","../component/grid","../component/dataZoom","../config","../util/ecData","zrender/tool/util","zrender/tool/color","../chart"],function(e){function t(e,t,n,a,o){i.call(this,e,t,n,a,o),this.refresh(a)}var i=e("./base"),n=e("zrender/shape/Rectangle");e("../component/axis"),e("../component/grid"),e("../component/dataZoom");var a=e("../config");a.bar={zlevel:0,z:2,clickable:!0,legendHoverLink:!0,xAxisIndex:0,yAxisIndex:0,barMinHeight:0,barGap:"30%",barCategoryGap:"20%",itemStyle:{normal:{barBorderColor:"#fff",barBorderRadius:0,barBorderWidth:0,label:{show:!1}},emphasis:{barBorderColor:"#fff",barBorderRadius:0,barBorderWidth:0,label:{show:!1}}}};var o=e("../util/ecData"),r=e("zrender/tool/util"),s=e("zrender/tool/color");return t.prototype={type:a.CHART_TYPE_BAR,_buildShape:function(){this._buildPosition()},_buildNormal:function(e,t,i,o,r){for(var s,l,h,d,c,m,p,u,V,U,g,f,y=this.series,b=i[0][0],_=y[b],x="horizontal"==r,k=this.component.xAxis,v=this.component.yAxis,L=x?k.getAxis(_.xAxisIndex):v.getAxis(_.yAxisIndex),w=this._mapSize(L,i),W=w.gap,X=w.barGap,I=w.barWidthMap,S=w.barMaxWidthMap,K=w.barWidth,C=w.barMinHeightMap,T=w.interval,E=this.deepQuery([this.ecTheme,a],"island.r"),z=0,A=t;A>z&&null!=L.getNameByIndex(z);z++){x?d=L.getCoordByIndex(z)-W/2:c=L.getCoordByIndex(z)+W/2;for(var M=0,F=i.length;F>M;M++){var J=y[i[M][0]].yAxisIndex||0,P=y[i[M][0]].xAxisIndex||0;s=x?v.getAxis(J):k.getAxis(P),p=m=V=u=s.getCoord(0);for(var O=0,D=i[M].length;D>O;O++)b=i[M][O],_=y[b],g=_.data[z],f=this.getDataFromOption(g,"-"),o[b]=o[b]||{min:Number.POSITIVE_INFINITY,max:Number.NEGATIVE_INFINITY,sum:0,counter:0,average:0},h=Math.min(S[b]||Number.MAX_VALUE,I[b]||K),"-"!==f&&(f>0?(l=O>0?s.getCoordSize(f):x?p-s.getCoord(f):s.getCoord(f)-p,1===D&&C[b]>l&&(l=C[b]),x?(m-=l,c=m):(d=m,m+=l)):0>f?(l=O>0?s.getCoordSize(f):x?s.getCoord(f)-V:V-s.getCoord(f),1===D&&C[b]>l&&(l=C[b]),x?(c=u,u+=l):(u-=l,d=u)):(l=0,x?(m-=l,c=m):(d=m,m+=l)),o[b][z]=x?d+h/2:c-h/2,o[b].min>f&&(o[b].min=f,x?(o[b].minY=c,o[b].minX=o[b][z]):(o[b].minX=d+l,o[b].minY=o[b][z])),o[b].max<f&&(o[b].max=f,x?(o[b].maxY=c,o[b].maxX=o[b][z]):(o[b].maxX=d+l,o[b].maxY=o[b][z])),o[b].sum+=f,o[b].counter++,z%T===0&&(U=this._getBarItem(b,z,L.getNameByIndex(z),d,c-(x?0:h),x?h:l,x?l:h,x?"vertical":"horizontal"),this.shapeList.push(new n(U))));for(var O=0,D=i[M].length;D>O;O++)b=i[M][O],_=y[b],g=_.data[z],f=this.getDataFromOption(g,"-"),h=Math.min(S[b]||Number.MAX_VALUE,I[b]||K),"-"==f&&this.deepQuery([g,_,this.option],"calculable")&&(x?(m-=E,c=m):(d=m,m+=E),U=this._getBarItem(b,z,L.getNameByIndex(z),d,c-(x?0:h),x?h:E,x?E:h,x?"vertical":"horizontal"),U.hoverable=!1,U.draggable=!1,U.style.lineWidth=1,U.style.brushType="stroke",U.style.strokeColor=_.calculableHolderColor||this.ecTheme.calculableHolderColor||a.calculableHolderColor,this.shapeList.push(new n(U)));x?d+=h+X:c-=h+X}}this._calculMarkMapXY(o,i,x?"y":"x")},_buildHorizontal:function(e,t,i,n){return this._buildNormal(e,t,i,n,"horizontal")},_buildVertical:function(e,t,i,n){return this._buildNormal(e,t,i,n,"vertical")},_buildOther:function(e,t,i,a){for(var o=this.series,r=0,s=i.length;s>r;r++)for(var l=0,h=i[r].length;h>l;l++){var d=i[r][l],c=o[d],m=c.xAxisIndex||0,p=this.component.xAxis.getAxis(m),u=p.getCoord(0),V=c.yAxisIndex||0,U=this.component.yAxis.getAxis(V),g=U.getCoord(0);a[d]=a[d]||{min0:Number.POSITIVE_INFINITY,min1:Number.POSITIVE_INFINITY,max0:Number.NEGATIVE_INFINITY,max1:Number.NEGATIVE_INFINITY,sum0:0,sum1:0,counter0:0,counter1:0,average0:0,average1:0};for(var f=0,y=c.data.length;y>f;f++){var b=c.data[f],_=this.getDataFromOption(b,"-");if(_ instanceof Array){var x,k,v=p.getCoord(_[0]),L=U.getCoord(_[1]),w=[b,c],W=this.deepQuery(w,"barWidth")||10,X=this.deepQuery(w,"barHeight");null!=X?(x="horizontal",_[0]>0?(W=v-u,v-=W):W=_[0]<0?u-v:0,k=this._getBarItem(d,f,_[0],v,L-X/2,W,X,x)):(x="vertical",_[1]>0?X=g-L:_[1]<0?(X=L-g,L-=X):X=0,k=this._getBarItem(d,f,_[0],v-W/2,L,W,X,x)),this.shapeList.push(new n(k)),v=p.getCoord(_[0]),L=U.getCoord(_[1]),a[d].min0>_[0]&&(a[d].min0=_[0],a[d].minY0=L,a[d].minX0=v),a[d].max0<_[0]&&(a[d].max0=_[0],a[d].maxY0=L,a[d].maxX0=v),a[d].sum0+=_[0],a[d].counter0++,a[d].min1>_[1]&&(a[d].min1=_[1],a[d].minY1=L,a[d].minX1=v),a[d].max1<_[1]&&(a[d].max1=_[1],a[d].maxY1=L,a[d].maxX1=v),a[d].sum1+=_[1],a[d].counter1++}}}this._calculMarkMapXY(a,i,"xy")},_mapSize:function(e,t,i){var n,a,o=this._findSpecialBarSzie(t,i),r=o.barWidthMap,s=o.barMaxWidthMap,l=o.barMinHeightMap,h=o.sBarWidthCounter,d=o.sBarWidthTotal,c=o.barGap,m=o.barCategoryGap,p=1;if(t.length!=h){if(i)n=e.getGap(),c=0,a=+(n/t.length).toFixed(2),0>=a&&(p=Math.floor(t.length/n),a=1);else if(n="string"==typeof m&&m.match(/%$/)?(e.getGap()*(100-parseFloat(m))/100).toFixed(2)-0:e.getGap()-m,"string"==typeof c&&c.match(/%$/)?(c=parseFloat(c)/100,a=+((n-d)/((t.length-1)*c+t.length-h)).toFixed(2),c=a*c):(c=parseFloat(c),a=+((n-d-c*(t.length-1))/(t.length-h)).toFixed(2)),0>=a)return this._mapSize(e,t,!0)}else if(n=h>1?"string"==typeof m&&m.match(/%$/)?+(e.getGap()*(100-parseFloat(m))/100).toFixed(2):e.getGap()-m:d,a=0,c=h>1?+((n-d)/(h-1)).toFixed(2):0,0>c)return this._mapSize(e,t,!0);return this._recheckBarMaxWidth(t,r,s,l,n,a,c,p)},_findSpecialBarSzie:function(e,t){for(var i,n,a,o,r=this.series,s={},l={},h={},d=0,c=0,m=0,p=e.length;p>m;m++)for(var u={barWidth:!1,barMaxWidth:!1},V=0,U=e[m].length;U>V;V++){var g=e[m][V],f=r[g];if(!t){if(u.barWidth)s[g]=i;else if(i=this.query(f,"barWidth"),null!=i){s[g]=i,c+=i,d++,u.barWidth=!0;for(var y=0,b=V;b>y;y++){var _=e[m][y];s[_]=i}}if(u.barMaxWidth)l[g]=n;else if(n=this.query(f,"barMaxWidth"),null!=n){l[g]=n,u.barMaxWidth=!0;for(var y=0,b=V;b>y;y++){var _=e[m][y];l[_]=n}}}h[g]=this.query(f,"barMinHeight"),a=null!=a?a:this.query(f,"barGap"),o=null!=o?o:this.query(f,"barCategoryGap")}return{barWidthMap:s,barMaxWidthMap:l,barMinHeightMap:h,sBarWidth:i,sBarMaxWidth:n,sBarWidthCounter:d,sBarWidthTotal:c,barGap:a,barCategoryGap:o}},_recheckBarMaxWidth:function(e,t,i,n,a,o,r,s){for(var l=0,h=e.length;h>l;l++){var d=e[l][0];i[d]&&i[d]<o&&(a-=o-i[d])}return{barWidthMap:t,barMaxWidthMap:i,barMinHeightMap:n,gap:a,barWidth:o,barGap:r,interval:s}},_getBarItem:function(e,t,i,n,a,r,l,h){var d,c=this.series,m=c[e],p=m.data[t],u=this._sIndex2ColorMap[e],V=[p,m],U=this.deepMerge(V,"itemStyle.normal"),g=this.deepMerge(V,"itemStyle.emphasis"),f=U.barBorderWidth;d={zlevel:m.zlevel,z:m.z,clickable:this.deepQuery(V,"clickable"),style:{x:n,y:a,width:r,height:l,brushType:"both",color:this.getItemStyleColor(this.deepQuery(V,"itemStyle.normal.color")||u,e,t,p),radius:U.barBorderRadius,lineWidth:f,strokeColor:U.barBorderColor},highlightStyle:{color:this.getItemStyleColor(this.deepQuery(V,"itemStyle.emphasis.color"),e,t,p),radius:g.barBorderRadius,lineWidth:g.barBorderWidth,strokeColor:g.barBorderColor},_orient:h};var y=d.style;d.highlightStyle.color=d.highlightStyle.color||("string"==typeof y.color?s.lift(y.color,-.3):y.color),y.x=Math.floor(y.x),y.y=Math.floor(y.y),y.height=Math.ceil(y.height),y.width=Math.ceil(y.width),f>0&&y.height>f&&y.width>f?(y.y+=f/2,y.height-=f,y.x+=f/2,y.width-=f):y.brushType="fill",d.highlightStyle.textColor=d.highlightStyle.color,d=this.addLabel(d,m,p,i,h);for(var b=[y,d.highlightStyle],_=0,x=b.length;x>_;_++){var k=b[_].textPosition;if("insideLeft"===k||"insideRight"===k||"insideTop"===k||"insideBottom"===k){var v=5;switch(k){case"insideLeft":b[_].textX=y.x+v,b[_].textY=y.y+y.height/2,b[_].textAlign="left",b[_].textBaseline="middle";break;case"insideRight":b[_].textX=y.x+y.width-v,b[_].textY=y.y+y.height/2,b[_].textAlign="right",b[_].textBaseline="middle";break;case"insideTop":b[_].textX=y.x+y.width/2,b[_].textY=y.y+v/2,b[_].textAlign="center",b[_].textBaseline="top";break;case"insideBottom":b[_].textX=y.x+y.width/2,b[_].textY=y.y+y.height-v/2,b[_].textAlign="center",b[_].textBaseline="bottom"}b[_].textPosition="specific",b[_].textColor=b[_].textColor||"#fff"}}return this.deepQuery([p,m,this.option],"calculable")&&(this.setCalculable(d),d.draggable=!0),o.pack(d,c[e],e,c[e].data[t],t,i),d},getMarkCoord:function(e,t){var i,n,a=this.series[e],o=this.xMarkMap[e],r=this.component.xAxis.getAxis(a.xAxisIndex),s=this.component.yAxis.getAxis(a.yAxisIndex);if(!t.type||"max"!==t.type&&"min"!==t.type&&"average"!==t.type)if(o.isHorizontal){i="string"==typeof t.xAxis&&r.getIndexByName?r.getIndexByName(t.xAxis):t.xAxis||0;var l=o[i];l=null!=l?l:"string"!=typeof t.xAxis&&r.getCoordByIndex?r.getCoordByIndex(t.xAxis||0):r.getCoord(t.xAxis||0),n=[l,s.getCoord(t.yAxis||0)]}else{i="string"==typeof t.yAxis&&s.getIndexByName?s.getIndexByName(t.yAxis):t.yAxis||0;var h=o[i];h=null!=h?h:"string"!=typeof t.yAxis&&s.getCoordByIndex?s.getCoordByIndex(t.yAxis||0):s.getCoord(t.yAxis||0),n=[r.getCoord(t.xAxis||0),h]}else{var d=null!=t.valueIndex?t.valueIndex:null!=o.maxX0?"1":"";n=[o[t.type+"X"+d],o[t.type+"Y"+d],o[t.type+"Line"+d],o[t.type+d]]}return n},refresh:function(e){e&&(this.option=e,this.series=e.series),this.backupShapeList(),this._buildShape()},addDataAnimation:function(e,t){function i(){V--,0===V&&t&&t()}for(var n=this.series,a={},r=0,s=e.length;s>r;r++)a[e[r][0]]=e[r];for(var l,h,d,c,m,p,u,V=0,r=this.shapeList.length-1;r>=0;r--)if(p=o.get(this.shapeList[r],"seriesIndex"),a[p]&&!a[p][3]&&"rectangle"===this.shapeList[r].type){if(u=o.get(this.shapeList[r],"dataIndex"),m=n[p],a[p][2]&&u===m.data.length-1){this.zr.delShape(this.shapeList[r].id);continue}if(!a[p][2]&&0===u){this.zr.delShape(this.shapeList[r].id);continue}"horizontal"===this.shapeList[r]._orient?(c=this.component.yAxis.getAxis(m.yAxisIndex||0).getGap(),d=a[p][2]?-c:c,l=0):(h=this.component.xAxis.getAxis(m.xAxisIndex||0).getGap(),l=a[p][2]?h:-h,d=0),this.shapeList[r].position=[0,0],V++,this.zr.animate(this.shapeList[r].id,"").when(this.query(this.option,"animationDurationUpdate"),{position:[l,d]}).done(i).start()}V||t&&t()}},r.inherits(t,i),e("../chart").define("bar",t),t});
>>>>>>> [OWL-30] Add Echarts map to Grafana
