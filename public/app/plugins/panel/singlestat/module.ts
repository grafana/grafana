///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import 'jquery.flot';
import {SingleStatCtrl} from './controller';
import {PanelDirective} from '../../../features/panel/panel';

class SingleStatPanel extends PanelDirective {
  templateUrl = 'app/plugins/panel/singlestat/module.html';
  controller = SingleStatCtrl;

  /** @ngInject */
  constructor(private $location, private linkSrv, private $timeout, private templateSrv) {
    super();
  }

  link(scope, elem, attrs, ctrl) {
    var $location = this.$location;
    var linkSrv = this.linkSrv;
    var $timeout = this.$timeout;
    var panel = ctrl.panel;
    var templateSrv = this.templateSrv;
    var data, linkInfo, $panelContainer;
    var firstRender = true;

    scope.$on('render', function() {
      if (firstRender) {
        var inner = elem.find('.singlestat-panel');
        if (inner.length) {
          elem = inner;
          $panelContainer = elem.parents('.panel-container');
          firstRender = false;
          hookupDrilldownLinkTooltip();
        }
      }

      render();
      ctrl.renderingCompleted();
    });

    function setElementHeight() {
      try {
        var height = scope.height || panel.height || ctrl.row.height;
        if (_.isString(height)) {
          height = parseInt(height.replace('px', ''), 10);
        }

        height -= 5; // padding
        height -= panel.title ? 24 : 9; // subtract panel title bar

        elem.css('height', height + 'px');

        return true;
      } catch (e) { // IE throws errors sometimes
        return false;
      }
    }

    function applyColoringThresholds(value, valueString) {
      if (!panel.colorValue) {
        return valueString;
      }

      var color = getColorForValue(data, value);
      if (color) {
        return '<span style="color:' + color + '">'+ valueString + '</span>';
      }

      return valueString;
    }

    function getSpan(className, fontSize, value)  {
      value = templateSrv.replace(value);
      return '<span class="' + className + '" style="font-size:' + fontSize + '">' +
        value + '</span>';
    }

    function getBigValueHtml() {
      var body = '<div class="singlestat-panel-value-container">';

      if (panel.prefix) { body += getSpan('singlestat-panel-prefix', panel.prefixFontSize, panel.prefix); }

      var value = applyColoringThresholds(data.valueRounded, data.valueFormated);
      body += getSpan('singlestat-panel-value', panel.valueFontSize, value);

      if (panel.postfix) { body += getSpan('singlestat-panel-postfix', panel.postfixFontSize, panel.postfix); }

      body += '</div>';

      return body;
    }

    function addSparkline() {
      var width = elem.width() + 20;
      var height = elem.height() || 100;

      var plotCanvas = $('<div></div>');
      var plotCss: any = {};
      plotCss.position = 'absolute';

      if (panel.sparkline.full) {
        plotCss.bottom = '5px';
        plotCss.left = '-5px';
        plotCss.width = (width - 10) + 'px';
        var dynamicHeightMargin = height <= 100 ? 5 : (Math.round((height/100)) * 15) + 5;
        plotCss.height = (height - dynamicHeightMargin) + 'px';
      } else {
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
          min: ctrl.range.from.valueOf(),
          max: ctrl.range.to.valueOf(),
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
      if (!ctrl.data) { return; }

      data = ctrl.data;
      setElementHeight();

      var body = getBigValueHtml();

      if (panel.colorBackground && !isNaN(data.valueRounded)) {
        var color = getColorForValue(data, data.valueRounded);
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

      if (panel.links.length > 0) {
        linkInfo = linkSrv.getPanelLinkAnchorInfo(panel.links[0], panel.scopedVars);
      } else {
        linkInfo = null;
      }
    }

    function hookupDrilldownLinkTooltip() {
      // drilldown link tooltip
      var drilldownTooltip = $('<div id="tooltip" class="">hello</div>"');

      elem.mouseleave(function() {
        if (panel.links.length === 0) { return;}
        drilldownTooltip.detach();
      });

      elem.click(function(evt) {
        if (!linkInfo) { return; }
        // ignore title clicks in title
        if ($(evt).parents('.panel-header').length > 0) { return; }

        if (linkInfo.target === '_blank') {
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
        if (!linkInfo) { return;}

        drilldownTooltip.text('click to go to: ' + linkInfo.title);
        drilldownTooltip.place_tt(e.pageX+20, e.pageY-15);
      });
    }
  }
}

function getColorForValue(data, value) {
  for (var i = data.thresholds.length; i > 0; i--) {
    if (value >= data.thresholds[i-1]) {
      return data.colorMap[i];
    }
  }
  return _.first(data.colorMap);
}

export {
  SingleStatPanel,
  SingleStatPanel as Panel,
  getColorForValue
};
