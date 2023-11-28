import { __awaiter } from "tslib";
import { cloneDeep, isNumber } from 'lodash';
import { dateTime } from '@grafana/data';
import { coreModule } from 'app/angular/core_module';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from '../../../features/annotations/api';
import { getDashboardQueryRunner } from '../../../features/query/state/DashboardQueryRunner/DashboardQueryRunner';
export class EventEditorCtrl {
    constructor() { }
    $onInit() {
        this.event.panelId = this.panelCtrl.panel.id; // set correct id if in panel edit
        this.event.dashboardUID = this.panelCtrl.dashboard.uid;
        // Annotations query returns time as Unix timestamp in milliseconds
        this.event.time = tryEpochToMoment(this.event.time);
        if (this.event.isRegion) {
            this.event.timeEnd = tryEpochToMoment(this.event.timeEnd);
        }
        this.timeFormated = this.panelCtrl.dashboard.formatDate(this.event.time);
    }
    canDelete() {
        var _a, _b, _c;
        if (((_a = this.event.source) === null || _a === void 0 ? void 0 : _a.type) === 'dashboard') {
            return !!((_b = this.panelCtrl.dashboard.meta.annotationsPermissions) === null || _b === void 0 ? void 0 : _b.dashboard.canDelete);
        }
        return !!((_c = this.panelCtrl.dashboard.meta.annotationsPermissions) === null || _c === void 0 ? void 0 : _c.organization.canDelete);
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.form.$valid) {
                return;
            }
            const saveModel = cloneDeep(this.event);
            saveModel.time = saveModel.time.valueOf();
            saveModel.timeEnd = 0;
            if (saveModel.isRegion) {
                saveModel.timeEnd = this.event.timeEnd.valueOf();
                if (saveModel.timeEnd < saveModel.time) {
                    console.log('invalid time');
                    return;
                }
            }
            let crudFunction = saveAnnotation;
            if (saveModel.id) {
                crudFunction = updateAnnotation;
            }
            try {
                yield crudFunction(saveModel);
            }
            catch (err) {
                console.log(err);
            }
            finally {
                this.close();
                getDashboardQueryRunner().run({ dashboard: this.panelCtrl.dashboard, range: this.panelCtrl.range });
            }
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield deleteAnnotation(this.event);
            }
            catch (err) {
                console.log(err);
            }
            finally {
                this.close();
                getDashboardQueryRunner().run({ dashboard: this.panelCtrl.dashboard, range: this.panelCtrl.range });
            }
        });
    }
}
function tryEpochToMoment(timestamp) {
    if (timestamp && isNumber(timestamp)) {
        const epoch = Number(timestamp);
        return dateTime(epoch);
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