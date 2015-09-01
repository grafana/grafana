  define([
  'angular',
  'jquery',
  'kbn',
  'moment',
  'lodash',
  'echarts',
  '../../../vendor/echarts/config',
  './graph.tooltip',
  'jquery.flot',
  'jquery.flot.events',
  'jquery.flot.selection',
  'jquery.flot.time',
  'jquery.flot.stack',
  'jquery.flot.stackpercent',
  'jquery.flot.fillbelow',
  'jquery.flot.crosshair'
],
function (angular, $, kbn, moment, _, ec, ecConfig, GraphTooltip) {
  'use strict';

  var module = angular.module('grafana.directives');
  module.directive('grafanaGraph', function($rootScope, timeSrv) {
    return {
      restrict: 'A',
      template: '<div> </div>',
      link: function(scope, elem) {
        var dashboard = scope.dashboard;
        var data, annotations;
        var sortedSeries;
        var graphHeight;
        var legendSideLastValue = null;
        scope.crosshairEmiter = false;

        scope.onAppEvent('setCrosshair', function(event, info) {
          // do not need to to this if event is from this panel
          if (info.scope === scope) {
            return;
          }

          if(dashboard.sharedCrosshair) {
            var plot = elem.data().plot;
            if (plot) {
              plot.setCrosshair({ x: info.pos.x, y: info.pos.y });
            }
          }
        });

        scope.onAppEvent('clearCrosshair', function() {
          var plot = elem.data().plot;
          if (plot) {
            plot.clearCrosshair();
          }
        });

        // Receive render events
        scope.$on('render',function(event, renderData) {
          data = renderData || data;
          if (!data) {
            scope.get_data();
            return;
          }
          annotations = data.annotations || annotations;
          render_panel();
        });

        function getLegendHeight(panelHeight) {
          if (!scope.panel.legend.show || scope.panel.legend.rightSide) {
            return 0;
          }
          if (scope.panel.legend.alignAsTable) {
            var total = 30 + (25 * data.length);
            return Math.min(total, Math.floor(panelHeight/2));
          } else {
            return 26;
          }
        }

        function setElementHeight() {
          try {
            graphHeight = scope.height || scope.panel.height || scope.row.height;
            if (_.isString(graphHeight)) {
              graphHeight = parseInt(graphHeight.replace('px', ''), 10);
            }

            graphHeight -= 5; // padding
            graphHeight -= scope.panel.title ? 24 : 9; // subtract panel title bar

            graphHeight = graphHeight - getLegendHeight(graphHeight); // subtract one line legend

            elem.css('height', graphHeight + 'px');

            return true;
          } catch(e) { // IE throws errors sometimes
            return false;
          }
        }

        function shouldAbortRender() {
          if (!data) {
            return true;
          }

          if ($rootScope.fullscreen && !scope.fullscreen) {
            return true;
          }

          if (!setElementHeight()) { return true; }

          if (_.isString(data)) {
            render_panel_as_graphite_png(data);
            return true;
          }

          if (elem.width() === 0) {
            return true;
          }
        }

        function drawHook(plot) {
          // Update legend values
          var yaxis = plot.getYAxes();
          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            var axis = yaxis[series.yaxis - 1];
            var formater = kbn.valueFormats[scope.panel.y_formats[series.yaxis - 1]];

            // decimal override
            if (_.isNumber(scope.panel.decimals)) {
              series.updateLegendValues(formater, scope.panel.decimals, null);
            } else {
              // auto decimals
              // legend and tooltip gets one more decimal precision
              // than graph legend ticks
              var tickDecimals = (axis.tickDecimals || -1) + 1;
              series.updateLegendValues(formater, tickDecimals, axis.scaledDecimals + 2);
            }

            if(!scope.$$phase) { scope.$digest(); }
          }

          // add left axis labels
          if (scope.panel.leftYAxisLabel) {
            var yaxisLabel = $("<div class='axisLabel left-yaxis-label'></div>")
              .text(scope.panel.leftYAxisLabel)
              .appendTo(elem);

            yaxisLabel.css("margin-top", yaxisLabel.width() / 2);
          }

          // add right axis labels
          if (scope.panel.rightYAxisLabel) {
            var rightLabel = $("<div class='axisLabel right-yaxis-label'></div>")
              .text(scope.panel.rightYAxisLabel)
              .appendTo(elem);

            rightLabel.css("margin-top", rightLabel.width() / 2);
          }
        }

        function processOffsetHook(plot, gridMargin) {
          if (scope.panel.leftYAxisLabel) { gridMargin.left = 20; }
          if (scope.panel.rightYAxisLabel) { gridMargin.right = 20; }
        }

        /**
         * @function name:  function render_panel()
         * @description:    This function renders panel.
         * @related issues: OWL-063
         * @param:          void
         * @return:         void
         * @author:         Don Hsieh
         * @since:          08/27/2015
         * @last modified:  08/27/2015
         * @called by:
         */
        // Function for rendering panel
        function render_panel() {
          if (shouldAbortRender()) {
            return;
          }

          var panel = scope.panel;
          var stack = panel.stack ? true : null;

          // Populate element
          var options = {
            hooks: {
              draw: [drawHook],
              processOffset: [processOffsetHook],
            },
            legend: { show: false },
            series: {
              stackpercent: panel.stack ? panel.percentage : false,
              stack: panel.percentage ? null : stack,
              lines:  {
                show: panel.lines,
                zero: false,
                fill: translateFillOption(panel.fill),
                lineWidth: panel.linewidth,
                steps: panel.steppedLine
              },
              bars:   {
                show: panel.bars,
                fill: 1,
                barWidth: 1,
                zero: false,
                lineWidth: 0
              },
              points: {
                show: panel.points,
                fill: 1,
                fillColor: false,
                radius: panel.points ? panel.pointradius : 2
                // little points when highlight points
              },
              map: {
                show: panel.map,
                fill: 1,
                fillColor: false
              },
              pie: {
                show: panel.pie,
                fill: 1,
                fillColor: false
              },
              ebar: {
                show: panel.ebar,
                fill: 1,
                fillColor: false
              },
              shadowSize: 1
            },
            yaxes: [],
            xaxis: {},
            grid: {
              minBorderMargin: 0,
              markings: [],
              backgroundColor: null,
              borderWidth: 0,
              hoverable: true,
              color: '#c8c8c8',
              margin: { left: 0, right: 0 },
            },
            selection: {
              mode: "x",
              color: '#666'
            },
            crosshair: {
              mode: panel.tooltip.shared || dashboard.sharedCrosshair ? "x" : null
            }
          };

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.applySeriesOverrides(panel.seriesOverrides);
            series.data = series.getFlotPairs(panel.nullPointMode, panel.y_formats);

            // if hidden remove points and disable stack
            if (scope.hiddenSeries[series.alias]) {
              series.data = [];
              series.stack = false;
            }
          }

          if (data.length && data[0].stats.timeStep) {
            options.series.bars.barWidth = data[0].stats.timeStep / 1.5;
          }

          addTimeAxis(options);
          addGridThresholds(options, panel);
          addAnnotations(options);
          configureAxisOptions(data, options);

          sortedSeries = _.sortBy(data, function(series) { return series.zindex; });

          /**
           * @function name:  function drawBar(elem, sortedSeries)
           * @description:    Draw a bar chart.
           * @related issues: OWL-061
           * @param:          object elem
           * @param:          object sortedSeries
           * @return:         void
           * @author:         WH Lin
           * @since:          08/28/2015
           * @last modified:  08/31/2015
           * @called by:      function callPlot(incrementRenderCounter)
           */
          function drawBar(elem, sortedSeries) {
            var timestamp = Math.floor(Date.now() / 1000).toString();
            var barId = 'barChart' + '_' + timestamp;
            var rand = Math.random() * 100000;
            barId = barId + rand.toString().substring(0, 5);
            elem.attr('id', barId);

            var locations = sortedSeries[0].datapoints[0];
            var provinces = locations.provinces;
            var data = [];
            var x_values = [];
            var y_values = [];

            _.forEach(provinces, function(location) {
              data.push([location.name, location.value]);
            });
            data.sort(function(a, b) {return b[1] - a[1];});
            for (var i in data) {
              x_values.push(data[i][0]);
              y_values.push(data[i][1]);
            }

            // build a color map as your need.
            var colorList = [];

            // bar 分區顯示不同顏色
            /*
            var colors = [];  // list of all colors
            colors.push({'name': 'red', 'hex': '#ff3333'});
            colors.push({'name': 'organge', 'hex': '#ff7333'});
            colors.push({'name': 'yellow', 'hex': '#ffb333'});
            colors.push({'name': 'green', 'hex': '#09aa3c'});

            var colorList = [];

            for (var j = 0; j < colors.length; j++) {
              for (var k = 0; k < Math.floor(data.length/colors.length); k++) {
                colorList.push(colors[j].hex);
              }
            }
            for (var l = 0; l < data.length%colors.length; l++) {
              colorList.push(colors[colors.length-1].hex);
            }
            */

            // bar 顏色為漸層
            // list of all colors for color gradient
            var grad_colors = [];
            // grad_colors.push({'name': 'red', 'start': '#d10000', 'end': '#ff7575'});
            // grad_colors.push({'name': 'orange', 'start': '#db4500', 'end': '#ffa175'});
            grad_colors.push({'name': 'yellow', 'start': '#E58200', 'end': '#FFF573'});
            // grad_colors.push({'name': 'green', 'start': '#158f00', 'end': '#bbff99'});
            // grad_colors.push({'name': 'blue', 'start': '#2c1ca0', 'end': '#6ecff2'});
            // grad_colors.push({'name': 'purple', 'start': '#5c00b3', 'end': '#bc75ff'});

            // choose a random color to display
            var c_rand = Math.floor(Math.random() * grad_colors.length);
            if (c_rand === grad_colors.length) {
              c_rand = grad_colors.length;
            }
            var start = {'r': parseInt(grad_colors[c_rand].start.substring(1, 3), 16),
                          'g': parseInt(grad_colors[c_rand].start.substring(3, 5), 16),
                          'b': parseInt(grad_colors[c_rand].start.substring(5, 7), 16)};
            var end = {'r': parseInt(grad_colors[c_rand].end.substring(1, 3), 16),
                        'g': parseInt(grad_colors[c_rand].end.substring(3, 5), 16),
                        'b': parseInt(grad_colors[c_rand].end.substring(5, 7), 16)};

            for (var j = 0; j < data.length; j++) {
              // color of the i-th bar
              var color = {'r': (start.r + j * Math.floor((end.r - start.r)/data.length)).toString(16),
                            'g': (start.g + j * Math.floor((end.g - start.g)/data.length)).toString(16),
                            'b': (start.b + j * Math.floor((end.b - start.b)/data.length)).toString(16)};
              for (var rgb in color) {
                if (parseInt(color[rgb], 16) < 0) {
                  color[rgb] = '00';
                } else if (color[rgb].length < 2) {
                  color[rgb] = '0' + color[rgb];
                }
              }
              var hex = '#' + color.r + color.g + color.b;
              colorList.push(hex);
            }

            var myChart = ec.init(document.getElementById(barId));
            var option = {
                tooltip: {
                    trigger: 'item'
                },
                calculable: true,
                grid: {
                    borderWidth: 0,
                    y: 80,
                    y2: 60
                },
                xAxis: [
                    {
                        type: 'category',
                        show: false,
                        data: x_values
                    }
                ],
                yAxis: [
                    {
                        type: 'value',
                        show: false
                    }
                ],
                series: [
                    {
                        name: 'servers',
                        type: 'bar',
                        itemStyle: {
                            normal: {
                                color: function(params) {
                                    return colorList[params.dataIndex];
                                },
                                label: {
                                    show: true,
                                    position: 'top',
                                    formatter: '{b}\n{c}'
                                }
                            }
                        },
                        data: y_values,
                    }
                ]
            };

            myChart.setOption(option, true);
            var paras = document.getElementById('graph-legend-series');

            if (paras) {
              paras.parentNode.removeChild(paras);
            }
          }

          /**
           * @function name:  function drawMap(elem, sortedSeries)
           * @description:    This function draws a map chart.
           * @related issues: OWL-062
           * @param:          object elem
           * @param:          object sortedSeries
           * @return:         void
           * @author:         Don Hsieh
           * @since:          08/28/2015
           * @last modified:  08/28/2015
           * @called by:      function callPlot(incrementRenderCounter)
           */
          function drawMap(elem, sortedSeries) {
            var timestamp = Math.floor(Date.now() / 1000).toString();
            var rand = Math.random() * 100000;
            var mapId = 'mapChart' + '_' + timestamp + rand.toString().substring(0, 5);
            elem.attr('id', mapId);
            var locations = sortedSeries[0].datapoints;
            locations = locations[0];
            var provinces = locations.provinces;
            var citiesInProvince = locations.citiesInProvince;
            var name = '';
            var obj = {};
            var data = [];
            // var geoCoord = {};
            var values = [];

            _.forEach(provinces, function(location) {
              name = location.name;
              obj = {};
              obj.name = name;
              obj.value = location.value;
              // obj.selected = false;
              data.push(obj);
              // geoCoord[name] = location.coord;
              values.push(location.value);
            });

            values.sort(function(a, b) {return b-a;});
            var top5 = [];
            _.forIn(values, function(value, key) {
              if (key < 5) {
                _.forEach(data, function(location) {
                  if (location.value === value) {
                    top5.push(location);
                  }
                });
              }
            });
            // console.log('function callPlot() top5 =', top5);
            var myChart = ec.init(document.getElementById(mapId));
            var seriesProvinces = {
                tooltip: {
                    trigger: 'item',
                    // formatter: '{b}'
                },
                name: 'server',
                type: 'map',
                mapType: 'china',
                mapLocation: {
                    // x: 'left',
                    // y: 'top',
                    // width: '30%'
                },
                roam: true,
                selectedMode : 'single',
                itemStyle:{
                    //normal:{label:{show:true}},
                    emphasis:{label:{show:true}}
                },
            };
            seriesProvinces.data = data;
            var option = {
                tooltip : {
                    trigger: 'item'
                },
                legend: {
                    orient: 'vertical',
                    // x:'right',
                    data:['servers']
                },
                dataRange: {
                    x:'right',
                    min : 0,
                    // max : 500,
                    max : Math.floor(values[0]),
                    calculable : true,
                    color: ['maroon','purple','red','orange','yellow','lightgreen'],
                    // precision: 0,
                    // color: ["#bbbfc2"],
                    // splitNumber: 0
                },
                // toolbox: {
                //     show : true,
                //     orient: 'vertical',
                //     x:'right',
                //     y:'center',
                //     feature : {
                //         mark : {show: true},
                //         dataView : {show: true, readOnly: false}
                //     }
                // },
                series : [],
                // animation: false
            };
            option.series[0] = seriesProvinces;

            myChart.on(ecConfig.EVENT.MAP_SELECTED, function (param) {
                var selected = param.selected;
                var selectedProvince;
                var name;
                _.forEach(option.series[0].data, function(province, key) {
                    name = province.name;
                    option.series[0].data[key].selected = selected[name];
                    if (selected[name]) {
                        selectedProvince = name;
                    }
                });
                if (typeof selectedProvince === 'undefined' || selectedProvince === '台湾') {
                    option.series.splice(1);
                    option.series[0] = seriesProvinces;
                    option.series[0].mapLocation.x = null;
                    myChart.setOption(option, true);
                    return;
                }
                option.series[1] = {
                    name: 'servers',
                    type: 'map',
                    mapType: selectedProvince,
                    itemStyle:{
                        normal:{label:{show:true}},
                        emphasis:{label:{show:true}}
                    },
                    mapLocation: {},
                    roam: true,
                    data:[
                        // {name: '重庆市',value: 0},
                        // {name: '北京市',value: 0},
                        // {name: '天津市',value: 0},
                        // {name: '上海市',value: 0},
                        // {name: '香港',value: 0},
                        // {name: '澳门',value: 0},
                        // {name: '巴音郭楞蒙古自治州',value: 0},
                        // {name: '和田地区',value: 0},
                        // {name: '哈密地区',value: 0},
                        // {name: '阿克苏地区',value: 0},
                        // {name: '阿勒泰地区',value: 0},
                        // {name: '喀什地区',value: 0},
                        // {name: '塔城地区',value: 0},
                        // {name: '昌吉回族自治州',value: 0},
                        // {name: '克孜勒苏柯尔克孜自治州',value: 0},
                        // {name: '吐鲁番地区',value: 0},
                        // {name: '伊犁哈萨克自治州',value: 0},
                        // {name: '博尔塔拉蒙古自治州',value: 0},
                        {name: '乌鲁木齐市',value: 0},
                        // {name: '克拉玛依市',value: 0},
                        // {name: '阿拉尔市',value: 0},
                        // {name: '图木舒克市',value: 0},
                        // {name: '五家渠市',value: 0},
                        // {name: '石河子市',value: 0},
                        // {name: '那曲地区',value: 0},
                        // {name: '阿里地区',value: 0},
                        // {name: '日喀则地区',value: 0},
                        // {name: '林芝地区',value: 0},
                        // {name: '昌都地区',value: 0},
                        // {name: '山南地区',value: 0},
                        // {name: '拉萨市',value: 0},
                        // {name: '呼伦贝尔市',value: 0},
                        // {name: '阿拉善盟',value: 0},
                        // {name: '锡林郭勒盟',value: 0},
                        // {name: '鄂尔多斯市',value: 0},
                        // {name: '赤峰市',value: 0},
                        // {name: '巴彦淖尔市',value: 0},
                        // {name: '通辽市',value: 0},
                        // {name: '乌兰察布市',value: 0},
                        // {name: '兴安盟',value: 0},
                        // {name: '包头市',value: 0},
                        // {name: '呼和浩特市',value: 0},
                        // {name: '乌海市',value: 0},
                        // {name: '海西蒙古族藏族自治州',value: 0},
                        // {name: '玉树藏族自治州',value: 0},
                        // {name: '果洛藏族自治州',value: 0},
                        // {name: '海南藏族自治州',value: 0},
                        // {name: '海北藏族自治州',value: 0},
                        // {name: '黄南藏族自治州',value: 0},
                        // {name: '海东地区',value: 0},
                        // {name: '西宁市',value: 0},
                        // {name: '甘孜藏族自治州',value: 0},
                        // {name: '阿坝藏族羌族自治州',value: 0},
                        // {name: '凉山彝族自治州',value: 0},
                        // {name: '绵阳市',value: 0},
                        // {name: '达州市',value: 0},
                        // {name: '广元市',value: 0},
                        // {name: '雅安市',value: 0},
                        // {name: '宜宾市',value: 0},
                        // {name: '乐山市',value: 0},
                        // {name: '南充市',value: 0},
                        // {name: '巴中市',value: 0},
                        // {name: '泸州市',value: 0},
                        {name: '成都市',value: 0},
                        // {name: '资阳市',value: 0},
                        // {name: '攀枝花市',value: 0},
                        // {name: '眉山市',value: 0},
                        // {name: '广安市',value: 0},
                        {name: '德阳市',value: 0},
                        // {name: '内江市',value: 0},
                        // {name: '遂宁市',value: 0},
                        // {name: '自贡市',value: 0},
                        // {name: '黑河市',value: 0},
                        // {name: '大兴安岭地区',value: 0},
                        {name: '哈尔滨市',value: 0},
                        // {name: '齐齐哈尔市',value: 0},
                        // {name: '牡丹江市',value: 0},
                        // {name: '绥化市',value: 0},
                        // {name: '伊春市',value: 0},
                        {name: '佳木斯市',value: 0},
                        // {name: '鸡西市',value: 0},
                        // {name: '双鸭山市',value: 0},
                        // {name: '大庆市',value: 0},
                        // {name: '鹤岗市',value: 0},
                        // {name: '七台河市',value: 0},
                        // {name: '酒泉市',value: 0},
                        // {name: '张掖市',value: 0},
                        // {name: '甘南藏族自治州',value: 0},
                        // {name: '武威市',value: 0},
                        // {name: '陇南市',value: 0},
                        // {name: '庆阳市',value: 0},
                        // {name: '白银市',value: 0},
                        // {name: '定西市',value: 0},
                        // {name: '天水市',value: 0},
                        {name: '兰州市',value: 0},
                        // {name: '平凉市',value: 0},
                        // {name: '临夏回族自治州',value: 0},
                        // {name: '金昌市',value: 0},
                        // {name: '嘉峪关市',value: 0},
                        // {name: '普洱市',value: 0},
                        // {name: '红河哈尼族彝族自治州',value: 0},
                        // {name: '文山壮族苗族自治州',value: 0},
                        // {name: '曲靖市',value: 0},
                        // {name: '楚雄彝族自治州',value: 0},
                        // {name: '大理白族自治州',value: 0},
                        // {name: '临沧市',value: 0},
                        // {name: '迪庆藏族自治州',value: 0},
                        // {name: '昭通市',value: 0},
                        {name: '昆明市',value: 0},
                        // {name: '丽江市',value: 0},
                        // {name: '西双版纳傣族自治州',value: 0},
                        // {name: '保山市',value: 0},
                        // {name: '玉溪市',value: 0},
                        // {name: '怒江傈僳族自治州',value: 0},
                        // {name: '德宏傣族景颇族自治州',value: 0},
                        // {name: '百色市',value: 0},
                        // {name: '河池市',value: 0},
                        // {name: '桂林市',value: 0},
                        {name: '南宁市',value: 0},
                        {name: '柳州市',value: 0},
                        // {name: '崇左市',value: 0},
                        // {name: '来宾市',value: 0},
                        // {name: '玉林市',value: 0},
                        // {name: '梧州市',value: 0},
                        // {name: '贺州市',value: 0},
                        // {name: '钦州市',value: 0},
                        // {name: '贵港市',value: 0},
                        // {name: '防城港市',value: 0},
                        // {name: '北海市',value: 0},
                        // {name: '怀化市',value: 0},
                        // {name: '永州市',value: 0},
                        // {name: '邵阳市',value: 0},
                        // {name: '郴州市',value: 0},
                        // {name: '常德市',value: 0},
                        // {name: '湘西土家族苗族自治州',value: 0},
                        {name: '衡阳市',value: 0},
                        // {name: '岳阳市',value: 0},
                        {name: '益阳市',value: 0},
                        {name: '长沙市',value: 0},
                        {name: '株洲市',value: 0},
                        // {name: '张家界市',value: 0},
                        // {name: '娄底市',value: 0},
                        // {name: '湘潭市',value: 0},
                        // {name: '榆林市',value: 0},
                        // {name: '延安市',value: 0},
                        // {name: '汉中市',value: 0},
                        // {name: '安康市',value: 0},
                        // {name: '商洛市',value: 0},
                        // {name: '宝鸡市',value: 0},
                        // {name: '渭南市',value: 0},
                        // {name: '咸阳市',value: 0},
                        {name: '西安市',value: 0},
                        // {name: '铜川市',value: 0},
                        // {name: '清远市',value: 0},
                        // {name: '韶关市',value: 0},
                        {name: '湛江市',value: 0},
                        // {name: '梅州市',value: 0},
                        // {name: '河源市',value: 0},
                        // {name: '肇庆市',value: 0},
                        // {name: '惠州市',value: 0},
                        // {name: '茂名市',value: 0},
                        // {name: '江门市',value: 0},
                        // {name: '阳江市',value: 0},
                        // {name: '云浮市',value: 0},
                        {name: '广州市',value: 0},
                        // {name: '汕尾市',value: 0},
                        // {name: '揭阳市',value: 0},
                        {name: '珠海市',value: 0},
                        {name: '佛山市',value: 0},
                        // {name: '潮州市',value: 0},
                        // {name: '汕头市',value: 0},
                        {name: '深圳市',value: 0},
                        {name: '东莞市',value: 0},
                        {name: '中山市',value: 0},
                        {name: '延边朝鲜族自治州',value: 0},
                        {name: '吉林市',value: 0},
                        // {name: '白城市',value: 0},
                        // {name: '松原市',value: 0},
                        {name: '长春市',value: 0},
                        // {name: '白山市',value: 0},
                        // {name: '通化市',value: 0},
                        // {name: '四平市',value: 0},
                        // {name: '辽源市',value: 0},
                        // {name: '承德市',value: 0},
                        {name: '张家口市',value: 0},
                        {name: '保定市',value: 0},
                        // {name: '唐山市',value: 0},
                        // {name: '沧州市',value: 0},
                        // {name: '石家庄市',value: 0},
                        // {name: '邢台市',value: 0},
                        // {name: '邯郸市',value: 0},
                        // {name: '秦皇岛市',value: 0},
                        // {name: '衡水市',value: 0},
                        {name: '廊坊市',value: 0},
                        // {name: '恩施土家族苗族自治州',value: 0},
                        // {name: '十堰市',value: 0},
                        {name: '宜昌市',value: 0},
                        // {name: '襄樊市',value: 0},
                        // {name: '黄冈市',value: 0},
                        // {name: '荆州市',value: 0},
                        // {name: '荆门市',value: 0},
                        {name: '咸宁市',value: 0},
                        {name: '随州市',value: 0},
                        // {name: '孝感市',value: 0},
                        {name: '武汉市',value: 0},
                        // {name: '黄石市',value: 0},
                        // {name: '神农架林区',value: 0},
                        // {name: '天门市',value: 0},
                        // {name: '仙桃市',value: 0},
                        // {name: '潜江市',value: 0},
                        // {name: '鄂州市',value: 0},
                        // {name: '遵义市',value: 0},
                        // {name: '黔东南苗族侗族自治州',value: 0},
                        // {name: '毕节地区',value: 0},
                        // {name: '黔南布依族苗族自治州',value: 0},
                        // {name: '铜仁地区',value: 0},
                        // {name: '黔西南布依族苗族自治州',value: 0},
                        // {name: '六盘水市',value: 0},
                        // {name: '安顺市',value: 0},
                        // {name: '贵阳市',value: 0},
                        // {name: '烟台市',value: 0},
                        {name: '临沂市',value: 0},
                        {name: '潍坊市',value: 0},
                        {name: '青岛市',value: 0},
                        // {name: '菏泽市',value: 0},
                        // {name: '济宁市',value: 0},
                        // {name: '德州市',value: 0},
                        {name: '滨州市',value: 0},
                        // {name: '聊城市',value: 0},
                        // {name: '东营市',value: 0},
                        {name: '济南市',value: 0},
                        // {name: '泰安市',value: 0},
                        {name: '威海市',value: 0},
                        // {name: '日照市',value: 0},
                        {name: '淄博市',value: 0},
                        {name: '枣庄市',value: 0},
                        // {name: '莱芜市',value: 0},
                        {name: '赣州市',value: 0},
                        // {name: '吉安市',value: 0},
                        // {name: '上饶市',value: 0},
                        // {name: '九江市',value: 0},
                        // {name: '抚州市',value: 0},
                        // {name: '宜春市',value: 0},
                        {name: '南昌市',value: 0},
                        {name: '景德镇市',value: 0},
                        // {name: '萍乡市',value: 0},
                        // {name: '鹰潭市',value: 0},
                        // {name: '新余市',value: 0},
                        {name: '南阳市',value: 0},
                        // {name: '信阳市',value: 0},
                        {name: '洛阳市',value: 0},
                        // {name: '驻马店市',value: 0},
                        // {name: '周口市',value: 0},
                        // {name: '商丘市',value: 0},
                        // {name: '三门峡市',value: 0},
                        // {name: '新乡市',value: 0},
                        // {name: '平顶山市',value: 0},
                        {name: '郑州市',value: 0},
                        // {name: '安阳市',value: 0},
                        {name: '开封市',value: 0},
                        {name: '焦作市',value: 0},
                        // {name: '许昌市',value: 0},
                        // {name: '濮阳市',value: 0},
                        // {name: '漯河市',value: 0},
                        // {name: '鹤壁市',value: 0},
                        // {name: '大连市',value: 0},
                        // {name: '朝阳市',value: 0},
                        // {name: '丹东市',value: 0},
                        // {name: '铁岭市',value: 0},
                        {name: '沈阳市',value: 0},
                        {name: '抚顺市',value: 0},
                        // {name: '葫芦岛市',value: 0},
                        {name: '阜新市',value: 0},
                        // {name: '锦州市',value: 0},
                        // {name: '鞍山市',value: 0},
                        // {name: '本溪市',value: 0},
                        // {name: '营口市',value: 0},
                        // {name: '辽阳市',value: 0},
                        // {name: '盘锦市',value: 0},
                        // {name: '忻州市',value: 0},
                        // {name: '吕梁市',value: 0},
                        {name: '临汾市',value: 0},
                        // {name: '晋中市',value: 0},
                        // {name: '运城市',value: 0},
                        // {name: '大同市',value: 0},
                        // {name: '长治市',value: 0},
                        // {name: '朔州市',value: 0},
                        // {name: '晋城市',value: 0},
                        {name: '太原市',value: 0},
                        // {name: '阳泉市',value: 0},
                        // {name: '六安市',value: 0},
                        // {name: '安庆市',value: 0},
                        // {name: '滁州市',value: 0},
                        // {name: '宣城市',value: 0},
                        {name: '阜阳市',value: 0},
                        // {name: '宿州市',value: 0},
                        // {name: '黄山市',value: 0},
                        // {name: '巢湖市',value: 0},
                        // {name: '亳州市',value: 0},
                        // {name: '池州市',value: 0},
                        {name: '合肥市',value: 0},
                        {name: '蚌埠市',value: 0},
                        // {name: '芜湖市',value: 0},
                        // {name: '淮北市',value: 0},
                        // {name: '淮南市',value: 0},
                        // {name: '马鞍山市',value: 0},
                        // {name: '铜陵市',value: 0},
                        // {name: '南平市',value: 0},
                        // {name: '三明市',value: 0},
                        // {name: '龙岩市',value: 0},
                        // {name: '宁德市',value: 0},
                        {name: '福州市',value: 0},
                        // {name: '漳州市',value: 0},
                        // {name: '泉州市',value: 0},
                        {name: '莆田市',value: 0},
                        {name: '厦门市',value: 0},
                        // {name: '丽水市',value: 0},
                        {name: '杭州市',value: 0},
                        {name: '温州市',value: 0},
                        {name: '宁波市',value: 0},
                        // {name: '舟山市',value: 0},
                        {name: '台州市',value: 0},
                        {name: '金华市',value: 0},
                        // {name: '衢州市',value: 0},
                        // {name: '绍兴市',value: 0},
                        // {name: '嘉兴市',value: 0},
                        // {name: '湖州市',value: 0},
                        // {name: '盐城市',value: 0},
                        // {name: '徐州市',value: 0},
                        // {name: '南通市',value: 0},
                        // {name: '淮安市',value: 0},
                        {name: '苏州市',value: 0},
                        // {name: '宿迁市',value: 0},
                        {name: '连云港市',value: 0},
                        {name: '扬州市',value: 0},
                        {name: '南京市',value: 0},
                        // {name: '泰州市',value: 0},
                        {name: '无锡市',value: 0},
                        {name: '常州市',value: 0},
                        {name: '镇江市',value: 0},
                        // {name: '吴忠市',value: 0},
                        // {name: '中卫市',value: 0},
                        // {name: '固原市',value: 0},
                        {name: '银川市',value: 0},
                        // {name: '石嘴山市',value: 0},
                        // {name: '儋州市',value: 0},
                        // {name: '文昌市',value: 0},
                        // {name: '乐东黎族自治县',value: 0},
                        // {name: '三亚市',value: 0},
                        // {name: '琼中黎族苗族自治县',value: 0},
                        // {name: '东方市',value: 0},
                        {name: '海口市',value: 0},
                        // {name: '万宁市',value: 0},
                        // {name: '澄迈县',value: 0},
                        // {name: '白沙黎族自治县',value: 0},
                        // {name: '琼海市',value: 0},
                        // {name: '昌江黎族自治县',value: 0},
                        // {name: '临高县',value: 0},
                        // {name: '陵水黎族自治县',value: 0},
                        // {name: '屯昌县',value: 0},
                        // {name: '定安县',value: 0},
                        // {name: '保亭黎族苗族自治县',value: 0},
                        // {name: '五指山市',value: 0}
                    ]
                };
                _.forEach(citiesInProvince, function(city) {
                  _.forEach(option.series[1].data, function(obj, key) {
                    if (obj.name.indexOf(city.name) === 0) {
                      option.series[1].data[key].value = city.value;
                    }
                  });
                });
                option.series[0].mapLocation.x = 'left';
                option.series[0].mapLocation.width = '30%';
                // console.log('function callPlot() option =', option);
                myChart.setOption(option, true);
            });
            myChart.setOption(option, true);
          }

          /**
           * @function name:  function drawPie(elem, sortedSeries)
           * @description:    This function draws a map chart.
           * @related issues: OWL-062
           * @param:          object elem
           * @param:          object sortedSeries
           * @return:         void
           * @author:         Don Hsieh
           * @since:          08/28/2015
           * @last modified:  08/28/2015
           * @called by:      function callPlot(incrementRenderCounter)
           */
          function drawPie(elem, sortedSeries) {
            var timestamp = Math.floor(Date.now() / 1000).toString();
            var rand = Math.random() * 100000;
            var pieId = 'pieChart' + '_' + timestamp + rand.toString().substring(0, 5);
            elem.attr('id', pieId);
            var locations = sortedSeries[0].datapoints;
            // console.log('function callPlot() PIE locations =', locations);
            locations = locations[0];
            var provinces = locations.provinces;
            var name = '';
            var obj = {};
            var data = [];
            var values = [];

            _.forEach(provinces, function(location) {
              name = location.name;
              obj = {};
              obj.name = name;
              obj.value = location.value;
              data.push(obj);
              values.push(location.value);
            });

            values.sort(function(a, b) {return b-a;});
            var top5 = [];
            _.forIn(values, function(value, key) {
              if (key < 5) {
                _.forEach(data, function(location) {
                  if (location.value === value) {
                    top5.push(location);
                  }
                });
              }
            });
            var myChart = ec.init(document.getElementById(pieId));
            var seriesProvinces = {
                name: 'servers',
                type:'pie',
                // radius : [20, min(width, height) / 2 * 75%],
                radius : [20, 75],
                center : ['50%', '50%'],
                // center : ['50%', 200],
                // center : ['25%', 200],
                roseType : 'radius',
                // width: '40%',       // for funnel
                // max: 40,            // for funnel
                itemStyle : {
                    normal : {
                        label : {
                            show : false
                        },
                        labelLine : {
                            show : false
                        }
                    },
                    emphasis : {
                        label : {
                            show : true
                        },
                        labelLine : {
                            show : true
                        }
                    }
                },
                data:[]
            };
            seriesProvinces.data = data;
            var option = {
                tooltip : {
                    trigger: 'item',
                    formatter: "{a} <br/>{b} : {c} ({d}%)"
                },
                // legend: {
                //     x : 'center',
                //     y : 'bottom',
                //     data:['rose1','rose2','rose3','rose4','rose5','rose6','rose7','rose8']
                // },
                // toolbox: {
                //     show : true,
                //     feature : {
                //         mark : {show: true},
                //         dataView : {show: true, readOnly: false},
                //         magicType : {
                //             show: true,
                //             type: ['pie', 'funnel']
                //         },
                //         restore : {show: true},
                //         saveAsImage : {show: true}
                //     }
                // },
                calculable : true,
                series : [],
                // animation: false
            };
            option.series[0] = seriesProvinces;
            myChart.setOption(option, true);
          }

          /**
           * @function name:  function callPlot(incrementRenderCounter)
           * @description:    This function executes plot.
           * @related issues: OWL-062, OWL-063, OWL-052, OWL-030
           * @related issues: OWL-063, OWL-052, OWL-030
           * @param:          integer incrementRenderCounter
           * @return:         void
           * @author:         Don Hsieh
           * @since:          08/20/2015
           * @last modified:  08/31/2015
           * @called by:
           */
          function callPlot(incrementRenderCounter) {
            if (sortedSeries.length && 'datapoints' in sortedSeries[0]) {
              try {
                if ('chartType' in sortedSeries[0].datapoints[0]) {
                  var str = 'Error: The current metric is [chart.' + sortedSeries[0].datapoints[0].chartType;
                  str += '], but the chart option in Display Styles is not ' + sortedSeries[0].datapoints[0].chartType + '.';
                  if (sortedSeries[0].datapoints[0].chartType === 'bar') {
                    if (!options.series.ebar.show) {
                      alert(str);
                    } else {
                      drawBar(elem, sortedSeries);
                    }
                  } else if (sortedSeries[0].datapoints[0].chartType === 'map') {
                    if (!options.series.map.show) {
                      alert(str);
                    } else {
                      drawMap(elem, sortedSeries);
                    }
                  } else if (sortedSeries[0].datapoints[0].chartType === 'pie') {
                    if (!options.series.pie.show) {
                      alert(str);
                    } else {
                      drawPie(elem, sortedSeries);
                    }
                  }
                } else {
                  $.plot(elem, sortedSeries, options);
                }
              } catch (e) {
                console.log('flotcharts error', e);
              }
            }

            if (incrementRenderCounter) {
              scope.panelRenderingComplete();
            }
          }

          if (shouldDelayDraw(panel)) {
            // temp fix for legends on the side, need to render twice to get dimensions right
            callPlot(false);
            setTimeout(function() { callPlot(true); }, 50);
            legendSideLastValue = panel.legend.rightSide;
          }
          else {
            callPlot(true);
          }
        }

        function translateFillOption(fill) {
          return fill === 0 ? 0.001 : fill/10;
        }

        function shouldDelayDraw(panel) {
          if (panel.legend.rightSide) {
            return true;
          }
          if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
            return true;
          }
        }

        function addTimeAxis(options) {
          var ticks = elem.width() / 100;
          var min = _.isUndefined(scope.range.from) ? null : scope.range.from.getTime();
          var max = _.isUndefined(scope.range.to) ? null : scope.range.to.getTime();

          options.xaxis = {
            timezone: dashboard.timezone,
            show: scope.panel['x-axis'],
            mode: "time",
            min: min,
            max: max,
            label: "Datetime",
            ticks: ticks,
            timeformat: time_format(scope.interval, ticks, min, max),
          };
        }

        function addGridThresholds(options, panel) {
          if (_.isNumber(panel.grid.threshold1)) {
            var limit1 = panel.grid.thresholdLine ? panel.grid.threshold1 : (panel.grid.threshold2 || null);
            options.grid.markings.push({
              yaxis: { from: panel.grid.threshold1, to: limit1 },
              color: panel.grid.threshold1Color
            });

            if (_.isNumber(panel.grid.threshold2)) {
              var limit2;
              if (panel.grid.thresholdLine) {
                limit2 = panel.grid.threshold2;
              } else {
                limit2 = panel.grid.threshold1 > panel.grid.threshold2 ?  -Infinity : +Infinity;
              }
              options.grid.markings.push({
                yaxis: { from: panel.grid.threshold2, to: limit2 },
                color: panel.grid.threshold2Color
              });
            }
          }
        }

        function addAnnotations(options) {
          if(!annotations || annotations.length === 0) {
            return;
          }

          var types = {};

          _.each(annotations, function(event) {
            if (!types[event.annotation.name]) {
              types[event.annotation.name] = {
                level: _.keys(types).length + 1,
                icon: {
                  icon: "fa fa-chevron-down",
                  size: event.annotation.iconSize,
                  color: event.annotation.iconColor,
                }
              };
            }

            if (event.annotation.showLine) {
              options.grid.markings.push({
                color: event.annotation.lineColor,
                lineWidth: 1,
                xaxis: { from: event.min, to: event.max }
              });
            }
          });

          options.events = {
            levels: _.keys(types).length + 1,
            data: annotations,
            types: types
          };
        }

        function configureAxisOptions(data, options) {
          var defaults = {
            position: 'left',
            show: scope.panel['y-axis'],
            min: scope.panel.grid.leftMin,
            index: 1,
            logBase: scope.panel.grid.leftLogBase || 1,
            max: scope.panel.percentage && scope.panel.stack ? 100 : scope.panel.grid.leftMax,
          };

          options.yaxes.push(defaults);

          if (_.findWhere(data, {yaxis: 2})) {
            var secondY = _.clone(defaults);
            secondY.index = 2,
            secondY.logBase = scope.panel.grid.rightLogBase || 1,
            secondY.position = 'right';
            secondY.min = scope.panel.grid.rightMin;
            secondY.max = scope.panel.percentage && scope.panel.stack ? 100 : scope.panel.grid.rightMax;
            options.yaxes.push(secondY);

            applyLogScale(options.yaxes[1], data);
            configureAxisMode(options.yaxes[1], scope.panel.y_formats[1]);
          }

          applyLogScale(options.yaxes[0], data);
          configureAxisMode(options.yaxes[0], scope.panel.y_formats[0]);
        }

        function applyLogScale(axis, data) {
          if (axis.logBase === 1) {
            return;
          }

          var series, i;
          var max = axis.max;

          if (max === null) {
            for (i = 0; i < data.length; i++) {
              series = data[i];
              if (series.yaxis === axis.index) {
                if (max < series.stats.max) {
                  max = series.stats.max;
                }
              }
            }
            if (max === void 0) {
              max = Number.MAX_VALUE;
            }
          }

          axis.min = axis.min !== null ? axis.min : 0;
          axis.ticks = [0, 1];
          var nextTick = 1;

          while (true) {
            nextTick = nextTick * axis.logBase;
            axis.ticks.push(nextTick);
            if (nextTick > max) {
              break;
            }
          }

          if (axis.logBase === 10) {
            axis.transform = function(v) { return Math.log(v+0.1); };
            axis.inverseTransform  = function (v) { return Math.pow(10,v); };
          } else {
            axis.transform = function(v) { return Math.log(v+0.1) / Math.log(axis.logBase); };
            axis.inverseTransform  = function (v) { return Math.pow(axis.logBase,v); };
          }
        }

        function configureAxisMode(axis, format) {
          axis.tickFormatter = function(val, axis) {
            return kbn.valueFormats[format](val, axis.tickDecimals, axis.scaledDecimals);
          };
        }

        function time_format(interval, ticks, min, max) {
          if (min && max && ticks) {
            var secPerTick = ((max - min) / ticks) / 1000;

            if (secPerTick <= 45) {
              return "%H:%M:%S";
            }
            if (secPerTick <= 7200) {
              return "%H:%M";
            }
            if (secPerTick <= 80000) {
              return "%m/%d %H:%M";
            }
            if (secPerTick <= 2419200) {
              return "%m/%d";
            }
            return "%Y-%m";
          }

          return "%H:%M";
        }

        function render_panel_as_graphite_png(url) {
          url += '&width=' + elem.width();
          url += '&height=' + elem.css('height').replace('px', '');
          url += '&bgcolor=1f1f1f'; // @grayDarker & @grafanaPanelBackground
          url += '&fgcolor=BBBFC2'; // @textColor & @grayLighter
          url += scope.panel.stack ? '&areaMode=stacked' : '';
          url += scope.panel.fill !== 0 ? ('&areaAlpha=' + (scope.panel.fill/10).toFixed(1)) : '';
          url += scope.panel.linewidth !== 0 ? '&lineWidth=' + scope.panel.linewidth : '';
          url += scope.panel.legend.show ? '&hideLegend=false' : '&hideLegend=true';
          url += scope.panel.grid.leftMin !== null ? '&yMin=' + scope.panel.grid.leftMin : '';
          url += scope.panel.grid.leftMax !== null ? '&yMax=' + scope.panel.grid.leftMax : '';
          url += scope.panel.grid.rightMin !== null ? '&yMin=' + scope.panel.grid.rightMin : '';
          url += scope.panel.grid.rightMax !== null ? '&yMax=' + scope.panel.grid.rightMax : '';
          url += scope.panel['x-axis'] ? '' : '&hideAxes=true';
          url += scope.panel['y-axis'] ? '' : '&hideYAxis=true';

          switch(scope.panel.y_formats[0]) {
            case 'bytes':
              url += '&yUnitSystem=binary';
              break;
            case 'bits':
              url += '&yUnitSystem=binary';
              break;
            case 'bps':
              url += '&yUnitSystem=si';
              break;
            case 'pps':
              url += '&yUnitSystem=si';
              break;
            case 'Bps':
              url += '&yUnitSystem=si';
              break;
            case 'short':
              url += '&yUnitSystem=si';
              break;
            case 'joule':
              url += '&yUnitSystem=si';
              break;
            case 'watt':
              url += '&yUnitSystem=si';
              break;
            case 'ev':
              url += '&yUnitSystem=si';
              break;
            case 'none':
              url += '&yUnitSystem=none';
              break;
          }

          switch(scope.panel.nullPointMode) {
            case 'connected':
              url += '&lineMode=connected';
              break;
            case 'null':
              break; // graphite default lineMode
            case 'null as zero':
              url += "&drawNullAsZero=true";
              break;
          }

          url += scope.panel.steppedLine ? '&lineMode=staircase' : '';

          elem.html('<img src="' + url + '"></img>');
        }

        new GraphTooltip(elem, dashboard, scope, function() {
          return sortedSeries;
        });

        elem.bind("plotselected", function (event, ranges) {
          scope.$apply(function() {
            timeSrv.setTime({
              from  : moment.utc(ranges.xaxis.from).toDate(),
              to    : moment.utc(ranges.xaxis.to).toDate(),
            });
          });
        });
      }
    };
  });
});
