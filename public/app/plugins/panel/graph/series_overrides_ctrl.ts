import _ from 'lodash';
import coreModule from 'app/core/core_module';

/** @ngInject */
export function SeriesOverridesCtrl($scope, $element, popoverSrv) {
  $scope.overrideMenu = [];
  $scope.currentOverrides = [];
  $scope.override = $scope.override || {};

  $scope.addOverrideOption = (name, propertyName, values) => {
    const option = {
      text: name,
      propertyName: propertyName,
      index: $scope.overrideMenu.length,
      values: values,
      submenu: _.map(values, value => {
        return { text: String(value), value: value };
      }),
    };

    $scope.overrideMenu.push(option);
  };

  $scope.setOverride = (item, subItem) => {
    // handle color overrides
    if (item.propertyName === 'color') {
      $scope.openColorSelector($scope.override['color']);
      return;
    }

    $scope.override[item.propertyName] = subItem.value;

    // automatically disable lines for this series and the fill below to series
    // can be removed by the user if they still want lines
    if (item.propertyName === 'fillBelowTo') {
      $scope.override['lines'] = false;
      $scope.ctrl.addSeriesOverride({ alias: subItem.value, lines: false });
    }

    $scope.updateCurrentOverrides();
    $scope.ctrl.render();
  };

  $scope.colorSelected = color => {
    $scope.override['color'] = color;
    $scope.updateCurrentOverrides();
    $scope.ctrl.render();
  };

  $scope.openColorSelector = color => {
    const fakeSeries = { color: color };
    popoverSrv.show({
      element: $element.find('.dropdown')[0],
      position: 'top center',
      openOn: 'click',
      template: '<series-color-picker-popover color="color" onColorChange="colorSelected" />',
      classNames: 'drop-popover drop-popover--transparent',
      model: {
        autoClose: true,
        colorSelected: $scope.colorSelected,
        series: fakeSeries,
        color,
      },
      onClose: () => {
        $scope.ctrl.render();
      },
    });
  };

  $scope.removeOverride = option => {
    delete $scope.override[option.propertyName];
    $scope.updateCurrentOverrides();
    $scope.ctrl.refresh();
  };

  $scope.getSeriesNames = () => {
    return _.map($scope.ctrl.seriesList, series => {
      return series.alias;
    });
  };

  $scope.updateCurrentOverrides = () => {
    $scope.currentOverrides = [];
    _.each($scope.overrideMenu, option => {
      const value = $scope.override[option.propertyName];
      if (_.isUndefined(value)) {
        return;
      }
      $scope.currentOverrides.push({
        name: option.text,
        propertyName: option.propertyName,
        value: String(value),
      });
    });
  };

  $scope.addOverrideOption('Bars', 'bars', [true, false]);
  $scope.addOverrideOption('Lines', 'lines', [true, false]);
  $scope.addOverrideOption('Line fill', 'fill', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  $scope.addOverrideOption('Line width', 'linewidth', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  $scope.addOverrideOption('Null point mode', 'nullPointMode', ['connected', 'null', 'null as zero']);
  $scope.addOverrideOption('Fill below to', 'fillBelowTo', $scope.getSeriesNames());
  $scope.addOverrideOption('Staircase line', 'steppedLine', [true, false]);
  $scope.addOverrideOption('Dashes', 'dashes', [true, false]);
  $scope.addOverrideOption('Dash Length', 'dashLength', [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
  ]);
  $scope.addOverrideOption('Dash Space', 'spaceLength', [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
  ]);
  $scope.addOverrideOption('Points', 'points', [true, false]);
  $scope.addOverrideOption('Points Radius', 'pointradius', [1, 2, 3, 4, 5]);
  $scope.addOverrideOption('Stack', 'stack', [true, false, 'A', 'B', 'C', 'D']);
  $scope.addOverrideOption('Color', 'color', ['change']);
  $scope.addOverrideOption('Y-axis', 'yaxis', [1, 2]);
  $scope.addOverrideOption('Z-index', 'zindex', [-3, -2, -1, 0, 1, 2, 3]);
  $scope.addOverrideOption('Transform', 'transform', ['negative-Y']);
  $scope.addOverrideOption('Legend', 'legend', [true, false]);
  $scope.addOverrideOption('Hide in tooltip', 'hideTooltip', [true, false]);
  $scope.updateCurrentOverrides();
}

coreModule.controller('SeriesOverridesCtrl', SeriesOverridesCtrl);
