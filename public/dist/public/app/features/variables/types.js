import { LoadingState, } from '@grafana/data';
import { NEW_VARIABLE_ID } from './state/types';
export var VariableRefresh;
(function (VariableRefresh) {
    VariableRefresh[VariableRefresh["never"] = 0] = "never";
    VariableRefresh[VariableRefresh["onDashboardLoad"] = 1] = "onDashboardLoad";
    VariableRefresh[VariableRefresh["onTimeRangeChanged"] = 2] = "onTimeRangeChanged";
})(VariableRefresh || (VariableRefresh = {}));
export var VariableHide;
(function (VariableHide) {
    VariableHide[VariableHide["dontHide"] = 0] = "dontHide";
    VariableHide[VariableHide["hideLabel"] = 1] = "hideLabel";
    VariableHide[VariableHide["hideVariable"] = 2] = "hideVariable";
})(VariableHide || (VariableHide = {}));
export var VariableSort;
(function (VariableSort) {
    VariableSort[VariableSort["disabled"] = 0] = "disabled";
    VariableSort[VariableSort["alphabeticalAsc"] = 1] = "alphabeticalAsc";
    VariableSort[VariableSort["alphabeticalDesc"] = 2] = "alphabeticalDesc";
    VariableSort[VariableSort["numericalAsc"] = 3] = "numericalAsc";
    VariableSort[VariableSort["numericalDesc"] = 4] = "numericalDesc";
    VariableSort[VariableSort["alphabeticalCaseInsensitiveAsc"] = 5] = "alphabeticalCaseInsensitiveAsc";
    VariableSort[VariableSort["alphabeticalCaseInsensitiveDesc"] = 6] = "alphabeticalCaseInsensitiveDesc";
})(VariableSort || (VariableSort = {}));
export var initialVariableModelState = {
    id: NEW_VARIABLE_ID,
    name: '',
    label: null,
    type: '',
    global: false,
    index: -1,
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    state: LoadingState.NotStarted,
    error: null,
    description: null,
};
//# sourceMappingURL=types.js.map