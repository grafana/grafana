import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Select, stylesFactory, useTheme2 } from '@grafana/ui';
import { COUNTRIES_GAZETTEER_PATH, getGazetteer } from '../gazetteer/gazetteer';
const defaultPaths = [
    {
        label: 'Countries',
        description: 'Lookup countries by name, two letter code, or three letter code',
        value: COUNTRIES_GAZETTEER_PATH,
    },
    {
        label: 'USA States',
        description: 'Lookup states by name or 2 ',
        value: 'public/gazetteer/usa-states.json',
    },
    {
        label: 'Airports',
        description: 'Lookup airports by id or code',
        value: 'public/gazetteer/airports.geojson',
    },
];
export const GazetteerPathEditor = ({ value, onChange, context, item, }) => {
    const styles = getStyles(useTheme2());
    const [gaz, setGaz] = useState();
    const settings = item.settings;
    useEffect(() => {
        function fetchData() {
            return __awaiter(this, void 0, void 0, function* () {
                const p = yield getGazetteer(value);
                setGaz(p);
            });
        }
        fetchData();
    }, [value, setGaz]);
    const { current, options } = useMemo(() => {
        let options = (settings === null || settings === void 0 ? void 0 : settings.options) ? [...settings.options] : [...defaultPaths];
        let current = options === null || options === void 0 ? void 0 : options.find((f) => f.value === (gaz === null || gaz === void 0 ? void 0 : gaz.path));
        if (!current && gaz) {
            current = {
                label: gaz.path,
                value: gaz.path,
            };
            options.push(current);
        }
        return { options, current };
    }, [gaz, settings === null || settings === void 0 ? void 0 : settings.options]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { value: current, options: options, onChange: (v) => onChange(v.value), allowCustomValue: true, formatCreateLabel: (txt) => `Load from URL: ${txt}` }),
        gaz && (React.createElement(React.Fragment, null,
            gaz.error && React.createElement(Alert, { title: gaz.error, severity: 'warning' }),
            gaz.count && (React.createElement("div", { className: styles.keys },
                React.createElement("b", null,
                    "(",
                    gaz.count,
                    ")"),
                gaz.examples(10).map((k) => (React.createElement("span", { key: k },
                    k,
                    ","))),
                gaz.count > 10 && ' ...'))))));
};
const getStyles = stylesFactory((theme) => {
    return {
        keys: css `
      margin-top: 4px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;

      > span {
        margin-left: 4px;
      }
    `,
    };
});
//# sourceMappingURL=GazetteerPathEditor.js.map