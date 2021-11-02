import { __awaiter, __generator } from "tslib";
import { cloneDeep, isNumber } from 'lodash';
import { coreModule } from 'app/core/core';
import { dateTime } from '@grafana/data';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from './api';
import { getDashboardQueryRunner } from '../query/state/DashboardQueryRunner/DashboardQueryRunner';
var EventEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function EventEditorCtrl() {
    }
    EventEditorCtrl.prototype.$onInit = function () {
        this.event.panelId = this.panelCtrl.panel.id; // set correct id if in panel edit
        this.event.dashboardId = this.panelCtrl.dashboard.id;
        // Annotations query returns time as Unix timestamp in milliseconds
        this.event.time = tryEpochToMoment(this.event.time);
        if (this.event.isRegion) {
            this.event.timeEnd = tryEpochToMoment(this.event.timeEnd);
        }
        this.timeFormated = this.panelCtrl.dashboard.formatDate(this.event.time);
    };
    EventEditorCtrl.prototype.save = function () {
        return __awaiter(this, void 0, void 0, function () {
            var saveModel, crudFunction, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.form.$valid) {
                            return [2 /*return*/];
                        }
                        saveModel = cloneDeep(this.event);
                        saveModel.time = saveModel.time.valueOf();
                        saveModel.timeEnd = 0;
                        if (saveModel.isRegion) {
                            saveModel.timeEnd = this.event.timeEnd.valueOf();
                            if (saveModel.timeEnd < saveModel.time) {
                                console.log('invalid time');
                                return [2 /*return*/];
                            }
                        }
                        crudFunction = saveAnnotation;
                        if (saveModel.id) {
                            crudFunction = updateAnnotation;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, crudFunction(saveModel)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _a.sent();
                        console.log(err_1);
                        return [3 /*break*/, 5];
                    case 4:
                        this.close();
                        getDashboardQueryRunner().run({ dashboard: this.panelCtrl.dashboard, range: this.panelCtrl.range });
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    EventEditorCtrl.prototype.delete = function () {
        return __awaiter(this, void 0, void 0, function () {
            var err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, 3, 4]);
                        return [4 /*yield*/, deleteAnnotation(this.event)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        err_2 = _a.sent();
                        console.log(err_2);
                        return [3 /*break*/, 4];
                    case 3:
                        this.close();
                        getDashboardQueryRunner().run({ dashboard: this.panelCtrl.dashboard, range: this.panelCtrl.range });
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return EventEditorCtrl;
}());
export { EventEditorCtrl };
function tryEpochToMoment(timestamp) {
    if (timestamp && isNumber(timestamp)) {
        var epoch = Number(timestamp);
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