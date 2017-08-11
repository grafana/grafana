define([
    'angular',
    'jquery.flot',
    'jquery.flot.selection'
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ClusterCtrl', function ($scope,$rootScope, backendSrv, healthSrv) {
      $scope.cluster = function () {
        $scope.initMetaData();
        backendSrv.alertD({
          method: 'get',
          url: '/correlation'
        }).then(function(res) {
          $scope.initFlot(res.data.groups);
        });
      };

      this.init = function () {
        $scope.initMetaData();
        $scope.initFlot(healthSrv.anomalyMetricsData);
      };

      $scope.initMetaData = function() {
        $scope.minX = -100;
        $scope.minY = -100;
        $scope.maxX = 1000;
        $scope.maxY = 1000;

        $scope.options = {
          xaxis:{
            min: $scope.minX,
            max: $scope.maxX
          },
          yaxis:{
            min: $scope.minY,
            max: $scope.maxY,
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
      };

      $scope.initFlot = function (metrics) {
        var self = this;
        var $tooltip = $('<div id="tooltip">');
        var $cluster = $('#cluster');
        var $overview = $('#overview');

        var plot = $.plot($cluster, setData(metrics), $scope.options);
        var overview = $.plot($overview, setData(metrics), $scope.options);
        this.showTooltip = function(title, innerHtml, pos) {
          var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ title + '</div> ' ;
          body += innerHtml + '</div>';
          $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
        };

        $cluster.bind("plotselected", function (event, ranges) {
          $scope.options.xaxis = {min: ranges.xaxis.from, max: ranges.xaxis.to};
          $scope.options.yaxis = {min: ranges.yaxis.from, max: ranges.yaxis.to};
          plot = $.plot($cluster, setData(metrics), $scope.options);
          overview.setSelection(ranges, true);
        });

        $overview.bind("plotselected", function (event, ranges) {
          plot.setSelection(ranges);
        });

        $cluster.bind("plothover", function (event, pos, item) {
          if (!item) {
            $tooltip.detach();
            return
          }
          var cluster = metrics[item.seriesIndex];
          var health = cluster.health ? "健康指数:" + cluster.health : "";
          self.showTooltip("聚合指标共" + cluster.numElements + "个", health, pos);
        });

        $cluster.bind("plotclick", function (event, pos, item) {
          if (!item) {
            $tooltip.detach();
            return
          }
          $rootScope.appEvent("anomaly-select", {seriesIndex: item.seriesIndex})
        });

        $cluster.mouseleave(function () {
          if (plot) {
            $tooltip.detach();
            plot.unhighlight();
          }
        });
      };

      function setData(groups) {
        return groups.map(function (item) {
          return {
            data: [[item.coorX, item.coorY]],
            points: {
              show: true,
              symbol: drawSymbol,
              fill: false,
              radius: function (numElements) {
                return (numElements > 20 ? 20 : numElements)
              }(item.numElements)
            }
          }
        })
      }

      function drawSymbol(ctx, x, y, radius, shadow) {
        ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    });
  });
