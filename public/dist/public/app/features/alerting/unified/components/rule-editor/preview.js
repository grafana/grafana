import { isGrafanaAlertState } from '../../../../../types/unified-alerting-dto';
// Alerts previews come in a DataFrame format which is more suited for displaying time series data
// In order to display a list of tags we need to transform DataFrame into set of labels
export function mapDataFrameToAlertPreview({ fields }) {
    var _a, _b, _c, _d, _e, _f;
    const labelFields = fields.filter((field) => !['State', 'Info'].includes(field.name));
    const stateFieldIndex = fields.findIndex((field) => field.name === 'State');
    const infoFieldIndex = fields.findIndex((field) => field.name === 'Info');
    const labelIndexes = labelFields.map((labelField) => fields.indexOf(labelField));
    const instanceStatusCount = (_b = (_a = fields[stateFieldIndex]) === null || _a === void 0 ? void 0 : _a.values.length) !== null && _b !== void 0 ? _b : 0;
    const instances = [];
    for (let index = 0; index < instanceStatusCount; index++) {
        const labelValues = labelIndexes.map((labelIndex) => [fields[labelIndex].name, fields[labelIndex].values[index]]);
        const state = (_d = (_c = fields[stateFieldIndex]) === null || _c === void 0 ? void 0 : _c.values) === null || _d === void 0 ? void 0 : _d[index];
        const info = (_f = (_e = fields[infoFieldIndex]) === null || _e === void 0 ? void 0 : _e.values) === null || _f === void 0 ? void 0 : _f[index];
        if (isGrafanaAlertState(state)) {
            instances.push({
                state: state,
                info: info,
                labels: Object.fromEntries(labelValues),
            });
        }
    }
    return { instances };
}
//# sourceMappingURL=preview.js.map