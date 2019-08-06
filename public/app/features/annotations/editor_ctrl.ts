import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import { DashboardModel } from 'app/features/dashboard/state';
import DatasourceSrv from '../plugins/datasource_srv';

export class AnnotationsEditorCtrl {
  mode: any;
  datasources: any;
  annotations: any;
  currentAnnotation: any;
  currentDatasource: any;
  currentIsNew: any;
  dashboard: DashboardModel;

  annotationDefaults: any = {
    name: '',
    datasource: null,
    iconColor: 'rgba(255, 96, 96, 1)',
    enable: true,
    showIn: 0,
    hide: false,
  };

  showOptions: any = [{ text: 'All Panels', value: 0 }, { text: 'Specific Panels', value: 1 }];

  /** @ngInject */
  constructor($scope: any, private datasourceSrv: DatasourceSrv) {
    $scope.ctrl = this;

    this.dashboard = $scope.dashboard;
    this.mode = 'list';
    this.datasources = datasourceSrv.getAnnotationSources();
    this.annotations = this.dashboard.annotations.list;
    this.reset();

    this.onColorChange = this.onColorChange.bind(this);
  }

  async datasourceChanged() {
    return (this.currentDatasource = await this.datasourceSrv.get(this.currentAnnotation.datasource));
  }

  edit(annotation: any) {
    this.currentAnnotation = annotation;
    this.currentAnnotation.showIn = this.currentAnnotation.showIn || 0;
    this.currentIsNew = false;
    this.datasourceChanged();
    this.mode = 'edit';
    $('.tooltip.in').remove();
  }

  reset() {
    this.currentAnnotation = angular.copy(this.annotationDefaults);
    this.currentAnnotation.datasource = this.datasources[0].name;
    this.currentIsNew = true;
    this.datasourceChanged();
  }

  update() {
    this.reset();
    this.mode = 'list';
  }

  setupNew() {
    this.mode = 'new';
    this.reset();
  }

  backToList() {
    this.mode = 'list';
  }

  move(index: number, dir: number) {
    // @ts-ignore
    _.move(this.annotations, index, index + dir);
  }

  add() {
    this.annotations.push(this.currentAnnotation);
    this.reset();
    this.mode = 'list';
    this.dashboard.updateSubmenuVisibility();
  }

  removeAnnotation(annotation: any) {
    const index = _.indexOf(this.annotations, annotation);
    this.annotations.splice(index, 1);
    this.dashboard.updateSubmenuVisibility();
  }

  onColorChange(newColor: string) {
    this.currentAnnotation.iconColor = newColor;
  }
}

coreModule.controller('AnnotationsEditorCtrl', AnnotationsEditorCtrl);
