import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
var AnnotationsEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function AnnotationsEditorCtrl($scope, datasourceSrv) {
        this.datasourceSrv = datasourceSrv;
        this.annotationDefaults = {
            name: '',
            datasource: null,
            iconColor: 'rgba(255, 96, 96, 1)',
            enable: true,
            showIn: 0,
            hide: false,
        };
        this.showOptions = [{ text: 'All Panels', value: 0 }, { text: 'Specific Panels', value: 1 }];
        $scope.ctrl = this;
        this.dashboard = $scope.dashboard;
        this.mode = 'list';
        this.datasources = datasourceSrv.getAnnotationSources();
        this.annotations = this.dashboard.annotations.list;
        this.reset();
        this.onColorChange = this.onColorChange.bind(this);
    }
    AnnotationsEditorCtrl.prototype.datasourceChanged = function () {
        var _this = this;
        return this.datasourceSrv.get(this.currentAnnotation.datasource).then(function (ds) {
            _this.currentDatasource = ds;
        });
    };
    AnnotationsEditorCtrl.prototype.edit = function (annotation) {
        this.currentAnnotation = annotation;
        this.currentAnnotation.showIn = this.currentAnnotation.showIn || 0;
        this.currentIsNew = false;
        this.datasourceChanged();
        this.mode = 'edit';
        $('.tooltip.in').remove();
    };
    AnnotationsEditorCtrl.prototype.reset = function () {
        this.currentAnnotation = angular.copy(this.annotationDefaults);
        this.currentAnnotation.datasource = this.datasources[0].name;
        this.currentIsNew = true;
        this.datasourceChanged();
    };
    AnnotationsEditorCtrl.prototype.update = function () {
        this.reset();
        this.mode = 'list';
    };
    AnnotationsEditorCtrl.prototype.setupNew = function () {
        this.mode = 'new';
        this.reset();
    };
    AnnotationsEditorCtrl.prototype.backToList = function () {
        this.mode = 'list';
    };
    AnnotationsEditorCtrl.prototype.move = function (index, dir) {
        _.move(this.annotations, index, index + dir);
    };
    AnnotationsEditorCtrl.prototype.add = function () {
        this.annotations.push(this.currentAnnotation);
        this.reset();
        this.mode = 'list';
        this.dashboard.updateSubmenuVisibility();
    };
    AnnotationsEditorCtrl.prototype.removeAnnotation = function (annotation) {
        var index = _.indexOf(this.annotations, annotation);
        this.annotations.splice(index, 1);
        this.dashboard.updateSubmenuVisibility();
    };
    AnnotationsEditorCtrl.prototype.onColorChange = function (newColor) {
        this.currentAnnotation.iconColor = newColor;
    };
    return AnnotationsEditorCtrl;
}());
export { AnnotationsEditorCtrl };
coreModule.controller('AnnotationsEditorCtrl', AnnotationsEditorCtrl);
//# sourceMappingURL=editor_ctrl.js.map