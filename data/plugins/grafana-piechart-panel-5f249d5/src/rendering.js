import _ from 'lodash';
import $ from 'jquery';
import 'jquery.flot';
import 'jquery.flot.pie';

export default function link(scope, elem, attrs, ctrl) {
  var data, panel;
  elem = elem.find('.piechart-panel__chart');
  var $tooltip = $('<div id="tooltip">');

  ctrl.events.on('render', function () {
    render(false);
    if (panel.legendType === 'Right side') {
      setTimeout(function () { render(true); }, 50);
    }
  });

  function getLegendHeight(panelHeight) {
    if (!ctrl.panel.legend.show || ctrl.panel.legendType === 'Right side' || ctrl.panel.legendType === 'On graph') {
      return 20;
    }

    if (ctrl.panel.legendType == 'Under graph' && ctrl.panel.legend.percentage || ctrl.panel.legend.values) {
      let breakPoint = parseInt(ctrl.panel.breakPoint) / 100;
      var total = 23 + 20 * data.length;
      return Math.min(total, Math.floor(panelHeight * breakPoint));
    }
  }

  function formatter(label, slice) {
    var slice_data = slice.data[0][slice.data[0].length - 1];
    var decimal = 2;
    var start = "<div style='font-size:" + ctrl.panel.fontSize + ";text-align:center;padding:2px;color:" + slice.color + ";'>" + label + "<br/>";

    if (ctrl.panel.legend.percentageDecimals) {
      decimal = ctrl.panel.legend.percentageDecimals;
    }
    if (ctrl.panel.legend.values && ctrl.panel.legend.percentage) {
      return start + ctrl.formatValue(slice_data) + "<br/>" + slice.percent.toFixed(decimal) + "%</div>";
    } else if (ctrl.panel.legend.values) {
      return start + ctrl.formatValue(slice_data) + "</div>";
    } else if (ctrl.panel.legend.percentage) {
      return start + slice.percent.toFixed(decimal) + "%</div>";
    } else {
      return start + '</div>';
    }
  }

  function noDataPoints() {
    var html = '<div class="datapoints-warning"><span class="small">No data points</span></div>';
    elem.html(html);
  }

  function addPieChart() {
    var width = elem.width();
    var height = ctrl.height - getLegendHeight(ctrl.height);

    var size = Math.min(width, height);

    var plotCanvas = $('<div></div>');
    var plotCss = {
      margin: 'auto',
      position: 'relative',
      paddingBottom: 20 + 'px',
      height: size + 'px'
    };

    plotCanvas.css(plotCss);

    var backgroundColor = $('body').css('background-color')

    var options = {
      legend: {
        show: false
      },
      series: {
        pie: {
          show: true,
          stroke: {
            color: backgroundColor,
            width: parseFloat(ctrl.panel.strokeWidth).toFixed(1)
          },
          label: {
            show: ctrl.panel.legend.show && ctrl.panel.legendType === 'On graph',
            formatter: formatter
          },
          highlight: {
            opacity: 0.0
          },
          combine: {
            threshold: ctrl.panel.combine.threshold,
            label: ctrl.panel.combine.label
          }
        }
      },
      grid: {
        hoverable: true,
        clickable: false
      }
    };

    if (panel.pieType === 'donut') {
      options.series.pie.innerRadius = 0.5;
    }

    data = ctrl.data;

    for (let i = 0; i < data.length; i++) {
      let series = data[i];

      // if hidden remove points
      if (ctrl.hiddenSeries[series.label]) {
        series.data = {};
      }
    }


    if (panel.legend.sort) {
      if (ctrl.panel.valueName !== panel.legend.sort) {
        panel.legend.sort = ctrl.panel.valueName;
      }
      if (panel.legend.sortDesc === true) {
        data.sort(function (a, b) {
          return b.legendData - a.legendData;
        });
      } else {
        data.sort(function (a, b) {
          return a.legendData - b.legendData;
        });
      }
    }

    elem.html(plotCanvas);

    $.plot(plotCanvas, data, options);
    plotCanvas.bind("plothover", function (event, pos, item) {
      if (!item) {
        $tooltip.detach();
        return;
      }

      var body;
      var percent = parseFloat(item.series.percent).toFixed(2);
      var formatted = ctrl.formatValue(item.series.data[0][1]);

      body = '<div class="piechart-tooltip-small"><div class="piechart-tooltip-time">';
      body += '<div class="piechart-tooltip-value">' + item.series.label + ': ' + formatted;
      body += " (" + percent + "%)" + '</div>';
      body += "</div></div>";

      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    });
  }

  function render(incrementRenderCounter) {
    if (!ctrl.data) { return; }

    data = ctrl.data;
    panel = ctrl.panel;

      if (0 == ctrl.data.length) {
        noDataPoints();
      } else {
        addPieChart();
      }

    if (incrementRenderCounter) {
      ctrl.renderingCompleted();
    }
  }
}

