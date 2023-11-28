import { __awaiter } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { Cascader } from '@grafana/ui';
export function ProfileTypesCascader(props) {
    const cascaderOptions = useCascaderOptions(props.profileTypes);
    return (React.createElement(Cascader, { placeholder: props.placeholder, separator: '-', displayAllSelectedLevels: true, initialValue: props.initialProfileTypeId, allowCustomValue: true, onSelect: props.onChange, options: cascaderOptions, changeOnSelect: false }));
}
// Turn profileTypes into cascader options
function useCascaderOptions(profileTypes) {
    return useMemo(() => {
        var _a;
        if (!profileTypes) {
            return [];
        }
        let mainTypes = new Map();
        // Classify profile types by name then sample type.
        // The profileTypes are something like cpu:sample:nanoseconds:sample:count or app.something.something
        for (let profileType of profileTypes) {
            let parts = [];
            if (profileType.id.indexOf(':') > -1) {
                parts = profileType.id.split(':');
            }
            const [name, type] = parts;
            if (!mainTypes.has(name)) {
                mainTypes.set(name, {
                    label: name,
                    value: name,
                    items: [],
                });
            }
            (_a = mainTypes.get(name)) === null || _a === void 0 ? void 0 : _a.items.push({
                label: type,
                value: profileType.id,
            });
        }
        return Array.from(mainTypes.values());
    }, [profileTypes]);
}
/**
 * Loads the profile types.
 *
 * This is exported and not used directly in the ProfileTypesCascader component because in some case we need to know
 * the profileTypes before rendering the cascader.
 * @param datasource
 */
export function useProfileTypes(datasource) {
    const [profileTypes, setProfileTypes] = useState();
    useEffect(() => {
        (() => __awaiter(this, void 0, void 0, function* () {
            const profileTypes = yield datasource.getProfileTypes();
            setProfileTypes(profileTypes);
        }))();
    }, [datasource]);
    return profileTypes;
}
//# sourceMappingURL=ProfileTypesCascader.js.map