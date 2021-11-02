import { defaultsDeep } from 'lodash';
var CloudWatchAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function CloudWatchAnnotationsQueryCtrl($scope) {
        this.annotation = $scope.ctrl.annotation;
        defaultsDeep(this.annotation, {
            namespace: '',
            metricName: '',
            expression: '',
            dimensions: {},
            region: 'default',
            id: '',
            alias: '',
            statistic: 'Average',
            matchExact: true,
            prefixMatching: false,
            actionPrefix: '',
            alarmNamePrefix: '',
        });
        this.onChange = this.onChange.bind(this);
    }
    CloudWatchAnnotationsQueryCtrl.prototype.onChange = function (query) {
        Object.assign(this.annotation, query);
    };
    CloudWatchAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return CloudWatchAnnotationsQueryCtrl;
}());
export { CloudWatchAnnotationsQueryCtrl };
//# sourceMappingURL=annotations_query_ctrl.js.map