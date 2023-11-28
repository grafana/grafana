import { css } from '@emotion/css';
import React from 'react';
import { InternalTimeZones } from '@grafana/data';
import { IconButton, TimeZonePicker, useStyles2 } from '@grafana/ui';
export const TimezonesEditor = ({ value, onChange }) => {
    const styles = useStyles2(getStyles);
    if (!value || value.length < 1) {
        value = [''];
    }
    const addTimezone = () => {
        onChange([...value, InternalTimeZones.default]);
    };
    const removeTimezone = (idx) => {
        const copy = value.slice();
        copy.splice(idx, 1);
        onChange(copy);
    };
    const setTimezone = (idx, tz) => {
        const copy = value.slice();
        copy[idx] = tz !== null && tz !== void 0 ? tz : InternalTimeZones.default;
        if (copy.length === 0 || (copy.length === 1 && copy[0] === '')) {
            onChange(undefined);
        }
        else {
            onChange(copy);
        }
    };
    return (React.createElement("div", null, value.map((tz, idx) => (React.createElement("div", { className: styles.wrapper, key: `${idx}.${tz}` },
        React.createElement("span", { className: styles.first },
            React.createElement(TimeZonePicker, { onChange: (v) => setTimezone(idx, v), includeInternal: true, value: tz !== null && tz !== void 0 ? tz : InternalTimeZones.default })),
        idx === value.length - 1 ? (React.createElement(IconButton, { name: "plus", onClick: addTimezone, tooltip: "Add timezone" })) : (React.createElement(IconButton, { name: "times", onClick: () => removeTimezone(idx), tooltip: "Remove timezone" })))))));
};
const getStyles = (theme) => ({
    wrapper: css `
    width: 100%;
    display: flex;
    flex-direction: rows;
    align-items: center;
  `,
    first: css `
    margin-right: 8px;
    flex-grow: 2;
  `,
});
//# sourceMappingURL=TimezonesEditor.js.map