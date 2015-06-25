define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'jquery.flot',
],
function (angular, app, _, $) {
  'use strict';

  var module = angular.module('grafana.panels.singlestat', []);
  app.useModule(module);

  module.directive('singlestatPanel', function($location, linkSrv, $timeout, templateSrv) {

    return {
      link: function(scope, elem) {
        var data, panel, coloring;
        var $panelContainer = elem.parents('.panel-container');

        scope.$on('render', function() {
          render();
          scope.panelRenderingComplete();
        });

        function setElementHeight() {
          try {
            var height = scope.height || panel.height || scope.row.height;
            if (_.isString(height)) {
              height = parseInt(height.replace('px', ''), 10);
            }

            height -= 5; // padding
            height -= panel.title ? 24 : 9; // subtract panel title bar

            elem.css('height', height + 'px');

            return true;
          } catch(e) { // IE throws errors sometimes
            return false;
          }
        }

        function applyColoringThresholds(value, valueString) {
          if (!coloring.colorValue) {
            return valueString;
          }

          var color = getColorForValue(value);
          if (color) {
            return '<span style="color:' + color + '">'+ valueString + '</span>';
          }

          return valueString;
        }

        function getColorForValue(value) {
          for (var i = coloring.thresholdValues.length - 1; i >= 0 ; i--) {
            if (value >= coloring.thresholdValues[i]) {
              return coloring.colors[i];
            }
          }
          return null;
        }

        function getSpan(className, fontSize, value)  {
          value = templateSrv.replace(value);
          return '<span class="' + className + '" style="font-size:' + fontSize + '">' +
            value + '</span>';
        }

        function getBigValueHtml() {
          var body = '<div class="singlestat-panel-value-container">';

          if (panel.prefix) { body += getSpan('singlestat-panel-prefix', panel.prefixFontSize, scope.panel.prefix); }

          var value = applyColoringThresholds(data.valueRounded, data.valueFormated);
          body += getSpan('singlestat-panel-value', panel.valueFontSize, value);

          if (panel.postfix) { body += getSpan('singlestat-panel-postfix', panel.postfixFontSize, panel.postfix); }

          body += '</div>';

          return body;
        }

        function addSparkline() {
          var panel = scope.panel;
          var width = elem.width() + 20;
          var height = elem.height() || 100;

          var plotCanvas = $('<div></div>');
          var plotCss = {};
          plotCss.position = 'absolute';

          if (panel.sparkline.full) {
            plotCss.bottom = '5px';
            plotCss.left = '-5px';
            plotCss.width = (width - 10) + 'px';
            plotCss.height = (height - 45) + 'px';
          }
          else {
            plotCss.bottom = "0px";
            plotCss.left = "-5px";
            plotCss.width = (width - 10) + 'px';
            plotCss.height = Math.floor(height * 0.25) + "px";
          }

          plotCanvas.css(plotCss);

          var options = {
            legend: { show: false },
            series: {
              lines:  {
                show: true,
                fill: 1,
                lineWidth: 1,
                fillColor: panel.sparkline.fillColor,
              },
            },
            yaxes: { show: false },
            xaxis: {
              show: false,
              mode: "time",
              min: scope.range.from.getTime(),
              max: scope.range.to.getTime(),
            },
            grid: { hoverable: false, show: false },
          };

          elem.append(plotCanvas);

          var plotSeries = {
            data: data.flotpairs,
            color: panel.sparkline.lineColor
          };

          $.plot(plotCanvas, [plotSeries], options);
        }

        function render() {
          if (!scope.data) { return; }

          data = scope.data;
          panel = scope.panel;

          setElementHeight();

          // should only be 1 target for single stat
          coloring = scope.panel.targets.length > 0 ? scope.panel.targets[0].coloring || {} : {};

          var body = getBigValueHtml();

          if (coloring.colorBackground && !isNaN(data.valueRounded)) {
            var color = getColorForValue(data.valueRounded);
            if (color) {
              $panelContainer.css('background-color', color);
              if (scope.fullscreen) {
                elem.css('background-color', color);
              } else {
                elem.css('background-color', '');
              }
            }
          } else {
            $panelContainer.css('background-color', '');
            elem.css('background-color', '');
          }

          elem.html(body);

          if (panel.sparkline.show) {
            addSparkline();
          }

          elem.toggleClass('pointer', panel.links.length > 0);
        }

        // drilldown link tooltip
        var drilldownTooltip = $('<div id="tooltip" class="">gello</div>"');

        elem.mouseleave(function() {
          if (panel.links.length === 0) { return;}
          drilldownTooltip.detach();
        });

        elem.click(function() {
          if (panel.links.length === 0) { return; }
          var link = panel.links[0];
          var linkInfo = linkSrv.getPanelLinkAnchorInfo(link);
          if (panel.links[0].targetBlank) {
            var redirectWindow = window.open(linkInfo.href, '_blank');
            redirectWindow.location;
            return;
          }

          if (linkInfo.href.indexOf('http') === 0) {
            window.location.href = linkInfo.href;
          } else {
            $timeout(function() {
              $location.url(linkInfo.href);
            });
          }

          drilldownTooltip.detach();
        });

        elem.mousemove(function(e) {
          if (panel.links.length === 0) { return;}

          drilldownTooltip.text('click to go to: ' + panel.links[0].title);

          drilldownTooltip.place_tt(e.pageX+20, e.pageY-15);
        });
      }
    };
  });

});
