import { __values } from "tslib";
import React, { useMemo, useCallback } from 'react';
import { toLower, isEmpty, isString } from 'lodash';
import { getTimeZoneInfo, getTimeZoneGroups, InternalTimeZones, } from '@grafana/data';
import { Select } from '../Select/Select';
import { CompactTimeZoneOption, WideTimeZoneOption } from './TimeZonePicker/TimeZoneOption';
import { TimeZoneGroup } from './TimeZonePicker/TimeZoneGroup';
import { formatUtcOffset } from './TimeZonePicker/TimeZoneOffset';
export var TimeZonePicker = function (props) {
    var onChange = props.onChange, width = props.width, _a = props.autoFocus, autoFocus = _a === void 0 ? false : _a, onBlur = props.onBlur, value = props.value, _b = props.includeInternal, includeInternal = _b === void 0 ? false : _b, _c = props.disabled, disabled = _c === void 0 ? false : _c;
    var groupedTimeZones = useTimeZones(includeInternal);
    var selected = useSelectedTimeZone(groupedTimeZones, value);
    var filterBySearchIndex = useFilterBySearchIndex();
    var TimeZoneOption = width && width <= 45 ? CompactTimeZoneOption : WideTimeZoneOption;
    var onChangeTz = useCallback(function (selectable) {
        if (!selectable || !isString(selectable.value)) {
            return onChange(value);
        }
        onChange(selectable.value);
    }, [onChange, value]);
    return (React.createElement(Select, { value: selected, placeholder: "Type to search (country, city, abbreviation)", autoFocus: autoFocus, openMenuOnFocus: true, width: width, filterOption: filterBySearchIndex, options: groupedTimeZones, onChange: onChangeTz, onBlur: onBlur, components: { Option: TimeZoneOption, Group: TimeZoneGroup }, disabled: disabled, "aria-label": 'Time zone picker' }));
};
var useTimeZones = function (includeInternal) {
    var now = Date.now();
    var timeZoneGroups = getTimeZoneGroups(includeInternal).map(function (group) {
        var options = group.zones.reduce(function (options, zone) {
            var info = getTimeZoneInfo(zone, now);
            if (!info) {
                return options;
            }
            options.push({
                label: info.name,
                value: info.zone,
                searchIndex: getSearchIndex(info, now),
            });
            return options;
        }, []);
        return {
            label: group.name,
            options: options,
        };
    });
    return timeZoneGroups;
};
var useSelectedTimeZone = function (groups, timeZone) {
    return useMemo(function () {
        if (timeZone === undefined) {
            return undefined;
        }
        var tz = toLower(timeZone);
        var group = groups.find(function (group) {
            if (!group.label) {
                return isInternal(tz);
            }
            return tz.startsWith(toLower(group.label));
        });
        return group === null || group === void 0 ? void 0 : group.options.find(function (option) {
            if (isEmpty(tz)) {
                return option.value === InternalTimeZones.default;
            }
            return toLower(option.value) === tz;
        });
    }, [groups, timeZone]);
};
var isInternal = function (timeZone) {
    switch (timeZone) {
        case InternalTimeZones.default:
        case InternalTimeZones.localBrowserTime:
        case InternalTimeZones.utc:
            return true;
        default:
            return false;
    }
};
var useFilterBySearchIndex = function () {
    return useCallback(function (option, searchQuery) {
        if (!searchQuery || !option.data || !option.data.searchIndex) {
            return true;
        }
        return option.data.searchIndex.indexOf(toLower(searchQuery)) > -1;
    }, []);
};
var getSearchIndex = function (info, timestamp) {
    var e_1, _a;
    var parts = [
        toLower(info.name),
        toLower(info.abbreviation),
        toLower(formatUtcOffset(timestamp, info.zone)),
    ];
    try {
        for (var _b = __values(info.countries), _c = _b.next(); !_c.done; _c = _b.next()) {
            var country = _c.value;
            parts.push(toLower(country.name));
            parts.push(toLower(country.code));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return parts.join('|');
};
//# sourceMappingURL=TimeZonePicker.js.map