import angular from 'angular';
import _ from 'lodash';
import appEvents from 'app/core/app_events';

export let iconMap = {
  'time range': 'fa-clock-o',
};

export function timeToString(hour, minute) {
  if (hour % 1 === 0 && minute % 1 === 0 && hour < 24 && hour >= 0 && minute < 60 && minute >= 0) {
    if (hour.toString().length === 1) {
      hour = '0' + hour;
    }
    if (minute.toString().length === 1) {
      minute = '0' + minute;
    }
    const TimeString = hour + ':' + minute;
    return TimeString;
  }
  throw new Error('Invalid input');
}

export class CustomTimeRangeEditorCtrl {
  dashboard: any;
  iconMap: any;
  mode: any;
  range: any;
  form: any;

  /** @ngInject */
  constructor($scope, $rootScope) {
    this.iconMap = iconMap;
    this.dashboard.ranges = this.dashboard.ranges || [];
    this.mode = 'list';

    $scope.$on('$destroy', () => {
      $rootScope.appEvent('custom-ranges-updated');
    });
  }

  isValid = () => {
    if (!this.form.$valid) {
      return false;
    }

    const sameName = _.find(this.dashboard.ranges, { name: this.range.name });
    if (sameName && sameName !== this.range) {
      appEvents.emit('alert-warning', ['Validation', 'Time Range with the same name already exists']);
      return false;
    }

    return true;
  };

  backToList() {
    this.mode = 'list';
  }

  setupNew() {
    this.mode = 'new';
    this.range = { type: 'shift', icon: 'time range' };
  }

  addRange() {
    if (this.isValid()) {
      this.range.from = timeToString(this.range.fromHour, this.range.fromMin);
      this.range.to = timeToString(this.range.toHour, this.range.toMin);
      this.dashboard.ranges.push(this.range);
      this.mode = 'list';
    }
  }

  editRange(range) {
    this.range = range;
    this.mode = 'edit';
  }

  saveRange() {
    if (this.isValid()) {
      this.range.from = timeToString(this.range.fromHour, this.range.fromMin);
      this.range.to = timeToString(this.range.toHour, this.range.toMin);
      this.backToList();
    }
  }

  moveRange(index, dir) {
    _.move(this.dashboard.ranges, index, index + dir);
  }

  deleteRange(index) {
    this.dashboard.ranges.splice(index, 1);
    this.dashboard.updateSubmenuVisibility();
  }
}

function customRangeEditor() {
  return {
    restrict: 'E',
    controller: CustomTimeRangeEditorCtrl,
    templateUrl: 'public/app/features/dashboard/customTimeRanges/editor.html',
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('customRangeEditor', customRangeEditor);
