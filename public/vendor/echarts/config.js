/**
 * echarts默认配置项
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function() {
    // 请原谅我这样写，这显然可以直接返回个对象，但那样的话outline就显示不出来了~~
    var config = {
        // 图表类型
        CHART_TYPE_LINE: 'line',
        CHART_TYPE_BAR: 'bar',
        CHART_TYPE_SCATTER: 'scatter',
        CHART_TYPE_PIE: 'pie',
        CHART_TYPE_RADAR: 'radar',
        CHART_TYPE_VENN: 'venn',
        CHART_TYPE_TREEMAP: 'treemap',
        CHART_TYPE_TREE: 'tree',
        CHART_TYPE_MAP: 'map',
        CHART_TYPE_K: 'k',
        CHART_TYPE_ISLAND: 'island',
        CHART_TYPE_FORCE: 'force',
        CHART_TYPE_CHORD: 'chord',
        CHART_TYPE_GAUGE: 'gauge',
        CHART_TYPE_FUNNEL: 'funnel',
        CHART_TYPE_EVENTRIVER: 'eventRiver',
        CHART_TYPE_WORDCLOUD: 'wordCloud',
        CHART_TYPE_HEATMAP: 'heatmap',

        // 组件类型
        COMPONENT_TYPE_TITLE: 'title',
        COMPONENT_TYPE_LEGEND: 'legend',
        COMPONENT_TYPE_DATARANGE: 'dataRange',
        COMPONENT_TYPE_DATAVIEW: 'dataView',
        COMPONENT_TYPE_DATAZOOM: 'dataZoom',
        COMPONENT_TYPE_TOOLBOX: 'toolbox',
        COMPONENT_TYPE_TOOLTIP: 'tooltip',
        COMPONENT_TYPE_GRID: 'grid',
        COMPONENT_TYPE_AXIS: 'axis',
        COMPONENT_TYPE_POLAR: 'polar',
        COMPONENT_TYPE_X_AXIS: 'xAxis',
        COMPONENT_TYPE_Y_AXIS: 'yAxis',
        COMPONENT_TYPE_AXIS_CATEGORY: 'categoryAxis',
        COMPONENT_TYPE_AXIS_VALUE: 'valueAxis',
        COMPONENT_TYPE_TIMELINE: 'timeline',
        COMPONENT_TYPE_ROAMCONTROLLER: 'roamController',

        // 全图默认背景
        backgroundColor: 'rgba(0,0,0,0)',
        
        // 默认色板
        color: ['#ff7f50','#87cefa','#da70d6','#32cd32','#6495ed',
                '#ff69b4','#ba55d3','#cd5c5c','#ffa500','#40e0d0',
                '#1e90ff','#ff6347','#7b68ee','#00fa9a','#ffd700',
                '#6699FF','#ff6666','#3cb371','#b8860b','#30e0e0'],

        markPoint: {
            clickable: true,
            symbol: 'pin',         // 标注类型
            symbolSize: 10,        // 标注大小，半宽（半径）参数，当图形为方向或菱形则总宽度为symbolSize * 2
            // symbolRotate: null, // 标注旋转控制
            large: false,
            effect: {
                show: false,
                loop: true,
                period: 15,             // 运动周期，无单位，值越大越慢
                type: 'scale',          // 可用为 scale | bounce
                scaleSize: 2,           // 放大倍数，以markPoint点size为基准
                bounceDistance: 10     // 跳动距离，单位px
                // color: 'gold',
                // shadowColor: 'rgba(255,215,0,0.8)',
                // shadowBlur: 0          // 炫光模糊
            },
            itemStyle: {
                normal: {
                    // color: 各异，
                    // borderColor: 各异,        // 标注边线颜色，优先于color 
                    borderWidth: 2,             // 标注边线线宽，单位px，默认为1
                    label: {
                        show: true,
                        // 标签文本格式器，同Tooltip.formatter，不支持回调
                        // formatter: null,
                        position: 'inside'      // 可选为'left'|'right'|'top'|'bottom'
                        // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                    }
                },
                emphasis: {
                    // color: 各异
                    label: {
                        show: true
                        // 标签文本格式器，同Tooltip.formatter，不支持回调
                        // formatter: null,
                        // position: 'inside'  // 'left'|'right'|'top'|'bottom'
                        // textStyle: null     // 默认使用全局文本样式，详见TEXTSTYLE
                    }
                }
            }
        },
        
        markLine: {
            clickable: true,
            // 标线起始和结束的symbol介绍类型，如果都一样，可以直接传string
            symbol: ['circle', 'arrow'],
            // 标线起始和结束的symbol大小，半宽（半径）参数，当图形为方向或菱形则总宽度为symbolSize * 2
            symbolSize: [2, 4],
            // 标线起始和结束的symbol旋转控制
            //symbolRotate: null,
            //smooth: false,
            smoothness: 0.2,    // 平滑度
            precision: 2,
            effect: {
                show: false,
                loop: true,
                period: 15,                     // 运动周期，无单位，值越大越慢
                scaleSize: 2                    // 放大倍数，以markLine线lineWidth为基准
                // color: 'gold',
                // shadowColor: 'rgba(255,215,0,0.8)',
                // shadowBlur: lineWidth * 2    // 炫光模糊，默认等于scaleSize计算所得
            },
            // 边捆绑
            bundling: {
                enable: false,
                // [0, 90]
                maxTurningAngle: 45
            },
            itemStyle: {
                normal: {
                    // color: 各异,               // 标线主色，线色，symbol主色
                    // borderColor: 随color,     // 标线symbol边框颜色，优先于color 
                    borderWidth: 1.5,           // 标线symbol边框线宽，单位px，默认为2
                    label: {
                        show: true,
                        // 标签文本格式器，同Tooltip.formatter，不支持回调
                        // formatter: null,
                        // 可选为 'start'|'end'|'left'|'right'|'top'|'bottom'
                        position: 'end'
                        // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                    },
                    lineStyle: {
                        // color: 随borderColor, // 主色，线色，优先级高于borderColor和color
                        // width: 随borderWidth, // 优先于borderWidth
                        type: 'dashed'
                        // shadowColor: 'rgba(0,0,0,0)', //默认透明
                        // shadowBlur: 0,
                        // shadowOffsetX: 0,
                        // shadowOffsetY: 0
                    }
                },
                emphasis: {
                    // color: 各异
                    label: {
                        show: false
                        // 标签文本格式器，同Tooltip.formatter，不支持回调
                        // formatter: null,
                        // position: 'inside' // 'left'|'right'|'top'|'bottom'
                        // textStyle: null    // 默认使用全局文本样式，详见TEXTSTYLE
                    },
                    lineStyle: {}
                }
            }
        },

        // 主题，主题
        textStyle: {
            decoration: 'none',
            fontFamily: 'Arial, Verdana, sans-serif',
            fontFamily2: '微软雅黑',    // IE8- 字体模糊并且，不支持不同字体混排，额外指定一份
            fontSize: 12,
            fontStyle: 'normal',
            fontWeight: 'normal'
        },

        EVENT: {
            // -------全局通用
            REFRESH: 'refresh',
            RESTORE: 'restore',
            RESIZE: 'resize',
            CLICK: 'click',
            DBLCLICK: 'dblclick',
            HOVER: 'hover',
            MOUSEOUT: 'mouseout',
            //MOUSEWHEEL: 'mousewheel',
            // -------业务交互逻辑
            DATA_CHANGED: 'dataChanged',
            DATA_ZOOM: 'dataZoom',
            DATA_RANGE: 'dataRange',
            DATA_RANGE_SELECTED: 'dataRangeSelected',
            DATA_RANGE_HOVERLINK: 'dataRangeHoverLink',
            LEGEND_SELECTED: 'legendSelected',
            LEGEND_HOVERLINK: 'legendHoverLink',
            MAP_SELECTED: 'mapSelected',
            PIE_SELECTED: 'pieSelected',
            MAGIC_TYPE_CHANGED: 'magicTypeChanged',
            DATA_VIEW_CHANGED: 'dataViewChanged',
            TIMELINE_CHANGED: 'timelineChanged',
            MAP_ROAM: 'mapRoam',
            FORCE_LAYOUT_END: 'forceLayoutEnd',
            // -------内部通信
            TOOLTIP_HOVER: 'tooltipHover',
            TOOLTIP_IN_GRID: 'tooltipInGrid',
            TOOLTIP_OUT_GRID: 'tooltipOutGrid',
            ROAMCONTROLLER: 'roamController'
        },
        DRAG_ENABLE_TIME: 120,   // 降低图表内元素拖拽敏感度，单位ms，不建议外部干预
        EFFECT_ZLEVEL : 10,       // 特效动画zlevel
        effectBlendAlpha: 0.95,
        // 主题，默认标志图形类型列表
        symbolList: [
          'circle', 'rectangle', 'triangle', 'diamond',
          'emptyCircle', 'emptyRectangle', 'emptyTriangle', 'emptyDiamond'
        ],
        loadingEffect: 'spin',
        loadingText: '数据读取中...',
        noDataEffect: 'bubble',
        noDataText: '暂无数据',
        // noDataLoadingOption: null,
        // 可计算特性配置，孤岛，提示颜色
        calculable: false,                      // 默认关闭可计算特性
        calculableColor: 'rgba(255,165,0,0.6)', // 拖拽提示边框颜色
        calculableHolderColor: '#ccc',          // 可计算占位提示颜色
        nameConnector: ' & ',
        valueConnector: ': ',
        animation: true,                // 过渡动画是否开启
        addDataAnimation: true,         // 动态数据接口是否开启动画效果
        animationThreshold: 2000,       // 动画元素阀值，产生的图形原素超过2000不出动画
        animationDuration: 2000,        // 过渡动画参数：进入
        animationDurationUpdate: 500,   // 过渡动画参数：更新
        animationEasing: 'ExponentialOut'    //BounceOut
    };

    return config;
});
