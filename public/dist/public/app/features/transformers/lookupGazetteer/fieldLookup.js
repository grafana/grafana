import { __awaiter } from "tslib";
import { mergeMap, from } from 'rxjs';
import { DataTransformerID, FieldMatcherID, fieldMatchers, } from '@grafana/data';
import { COUNTRIES_GAZETTEER_PATH, getGazetteer } from 'app/features/geo/gazetteer/gazetteer';
export const fieldLookupTransformer = {
    id: DataTransformerID.fieldLookup,
    name: 'Lookup fields from resource',
    description: 'Retrieve matching data based on specified field',
    defaultOptions: {},
    operator: (options) => (source) => source.pipe(mergeMap((data) => from(doGazetteerXform(data, options)))),
};
function doGazetteerXform(frames, options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get(options === null || options === void 0 ? void 0 : options.lookupField);
        const gazetteer = yield getGazetteer((_a = options === null || options === void 0 ? void 0 : options.gazetteer) !== null && _a !== void 0 ? _a : COUNTRIES_GAZETTEER_PATH);
        if (!gazetteer.frame) {
            return Promise.reject('missing frame in gazetteer');
        }
        return addFieldsFromGazetteer(frames, gazetteer, fieldMatches);
    });
}
export function addFieldsFromGazetteer(frames, gazetteer, matcher) {
    var _a;
    const gazetteerFields = (_a = gazetteer.frame()) === null || _a === void 0 ? void 0 : _a.fields;
    if (!gazetteerFields) {
        return frames;
    }
    return frames.map((frame) => {
        const frameLength = frame.length;
        const fields = [];
        for (const field of frame.fields) {
            fields.push(field);
            if (matcher(field, frame, frames)) {
                const values = field.values;
                const gazetteerFieldValuesBuffer = [];
                for (const gazetteerField of gazetteerFields) {
                    const buffer = new Array(frameLength);
                    gazetteerFieldValuesBuffer.push(buffer);
                    fields.push(Object.assign(Object.assign({}, gazetteerField), { values: buffer }));
                }
                for (let valueIndex = 0; valueIndex < gazetteer.count; valueIndex++) {
                    const foundValue = gazetteer.find(values[valueIndex]);
                    if ((foundValue === null || foundValue === void 0 ? void 0 : foundValue.index) != null) {
                        for (let fieldIndex = 0; fieldIndex < gazetteerFields.length; fieldIndex++) {
                            gazetteerFieldValuesBuffer[fieldIndex][valueIndex] = gazetteerFields[fieldIndex].values[foundValue.index];
                        }
                    }
                }
            }
        }
        return Object.assign(Object.assign({}, frame), { fields });
    });
}
//# sourceMappingURL=fieldLookup.js.map