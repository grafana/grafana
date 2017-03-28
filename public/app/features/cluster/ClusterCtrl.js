define([
    'angular',
    'jquery',
    'jquery.flot',
    'jquery.flot.selection'
  ],
  function (angular, _, dateMath) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ClusterCtrl', function ($scope, backendSrv, contextSrv, datasourceSrv) {
      $scope.init = function () {
        $scope.minX = -10;
        $scope.minY = -10;
        $scope.maxX = 1000;
        $scope.maxY = 1000;
        $scope.getRaduis = function (numElements) {
          return (numElements > 5 ? 6 : numElements)
        };

        $scope.options = {
          xaxis:{
            min: $scope.minX,
            max: $scope.maxX
          },
          yaxis:{
            min: $scope.minY,
            max: $scope.maxY,
            ticks: 10
          },
          grid: {
            hoverable: true,
            clickable: true
          },
          legend: {
            show: false
          },
          selection: {
            mode: "xy"
          }
        };

        $.get('https://alert.cloudwiz.cn/correlation?token=f1d27ad686042380695b1e3e1f1826c0d907411b',function (res) {
          $scope.initFlot(res);
        });
      };

      $scope.setData = function (groups) {
        return groups.map(function (item) {
          return {
            data : [[item.coorX,item.coorY]],
            label : item.numElements,
            points: {
              show: true,
              symbol: $scope.drawSymbol,
              fill: false,
              radius : $scope.getRaduis(item.numElements)
            },
          }
        })
      };

      $scope.drawSymbol = function(ctx, x, y, radius, shadow) {
        ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }

      $scope.initFlot = function (metrics) {
        var p = $.plot("#cluster", $scope.setData(metrics.groups), $scope.options);
        var overview = $.plot("#overview", $scope.setData(metrics.groups), {
          legend: {
            show: false
          },
          series: {
            lines: {
              show: true,
              lineWidth: 1
            },
            shadowSize: 0
          },
          xaxis: {
            ticks: 4
          },
          yaxis: {
            ticks: 3,
            min: $scope.minY,
            max: $scope.maxY
          },
          grid: {
            color: "#999"
          },
          selection: {
            mode: "xy"
          }
        });

        // now connect the two

        $("#cluster").bind("plotselected", function (event, ranges) {

          // clamp the zooming to prevent eternal zoom

          if (ranges.xaxis.to - ranges.xaxis.from < 0.001) {
            ranges.xaxis.to = ranges.xaxis.from + 0.001;
          }

          if (ranges.yaxis.to - ranges.yaxis.from < 0.001) {
            ranges.yaxis.to = ranges.yaxis.from + 0.001;
          }

          // do the zooming

          p = $.plot("#cluster", $scope.setData(metrics.groups),
            $.extend(true, {}, $scope.options, {
              xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
              yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
            })
          );

          // don't fire event on the overview to prevent eternal loop

          overview.setSelection(ranges, true);
        });

        $("#overview").bind("plotselected", function (event, ranges) {
          p.setSelection(ranges);
        });

        // $.each(p.getData(), function(i, el){
        //   var pos = el.data[0];
        //   var o = p.pointOffset({x: pos[0], y: pos[1]});
        //   $('<div class="data-point-label">' + el.label + '</div>').css( {
        //     position: 'absolute',
        //     left: o.left + 4,
        //     top: o.top - 43,
        //     display: 'none'
        //   }).appendTo(p.getPlaceholder()).fadeIn('slow');
        // });
      };
      $scope.init();
    });
  });
