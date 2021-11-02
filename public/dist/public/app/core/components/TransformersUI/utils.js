import { getFieldDisplayName } from '@grafana/data';
import { useMemo } from 'react';
export function useAllFieldNamesFromDataFrames(input) {
    return useMemo(function () {
        if (!Array.isArray(input)) {
            return [];
        }
        return Object.keys(input.reduce(function (names, frame) {
            if (!frame || !Array.isArray(frame.fields)) {
                return names;
            }
            return frame.fields.reduce(function (names, field) {
                var t = getFieldDisplayName(field, frame, input);
                names[t] = true;
                return names;
            }, names);
        }, {}));
    }, [input]);
}
//# sourceMappingURL=utils.js.map