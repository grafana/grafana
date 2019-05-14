import _ from 'lodash';
import moment from 'moment';
import { coreModule } from 'app/core/core';
var EventEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function EventEditorCtrl(annotationsSrv) {
        this.annotationsSrv = annotationsSrv;
        this.event.panelId = this.panelCtrl.panel.id;
        this.event.dashboardId = this.panelCtrl.dashboard.id;
        // Annotations query returns time as Unix timestamp in milliseconds
        this.event.time = tryEpochToMoment(this.event.time);
        if (this.event.isRegion) {
            this.event.timeEnd = tryEpochToMoment(this.event.timeEnd);
        }
        this.timeFormated = this.panelCtrl.dashboard.formatDate(this.event.time);
    }
    EventEditorCtrl.prototype.save = function () {
        var _this = this;
        if (!this.form.$valid) {
            return;
        }
        var saveModel = _.cloneDeep(this.event);
        saveModel.time = saveModel.time.valueOf();
        saveModel.timeEnd = 0;
        if (saveModel.isRegion) {
            saveModel.timeEnd = this.event.timeEnd.valueOf();
            if (saveModel.timeEnd < saveModel.time) {
                console.log('invalid time');
                return;
            }
        }
        if (saveModel.id) {
            this.annotationsSrv
                .updateAnnotationEvent(saveModel)
                .then(function () {
                _this.panelCtrl.refresh();
                _this.close();
            })
                .catch(function () {
                _this.panelCtrl.refresh();
                _this.close();
            });
        }
        else {
            this.annotationsSrv
                .saveAnnotationEvent(saveModel)
                .then(function () {
                _this.panelCtrl.refresh();
                _this.close();
            })
                .catch(function () {
                _this.panelCtrl.refresh();
                _this.close();
            });
        }
    };
    EventEditorCtrl.prototype.delete = function () {
        var _this = this;
        return this.annotationsSrv
            .deleteAnnotationEvent(this.event)
            .then(function () {
            _this.panelCtrl.refresh();
            _this.close();
        })
            .catch(function () {
            _this.panelCtrl.refresh();
            _this.close();
        });
    };
    return EventEditorCtrl;
}());
export { EventEditorCtrl };
function tryEpochToMoment(timestamp) {
    if (timestamp && _.isNumber(timestamp)) {
        var epoch = Number(timestamp);
        return moment(epoch);
    }
    else {
        return timestamp;
    }
}
export function eventEditor() {
    return {
        restrict: 'E',
        controller: EventEditorCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        templateUrl: 'public/app/features/annotations/partials/event_editor.html',
        scope: {
            panelCtrl: '=',
            event: '=',
            close: '&',
        },
    };
}
coreModule.directive('eventEditor', eventEditor);
//# sourceMappingURL=event_editor.js.map