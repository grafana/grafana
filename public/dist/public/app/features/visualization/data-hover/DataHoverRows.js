import { css } from '@emotion/css';
import { isString } from 'lodash';
import React, { useState } from 'react';
import { FieldType, getFieldDisplayName } from '@grafana/data';
import { Collapse, TabContent, useStyles2 } from '@grafana/ui';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';
import { DataHoverRow } from './DataHoverRow';
export const DataHoverRows = ({ layers, activeTabIndex }) => {
    const styles = useStyles2(getStyles);
    const [rowMap, setRowMap] = useState(new Map());
    const updateRowMap = (key, value) => {
        setRowMap(new Map(rowMap.set(key, value)));
    };
    return (React.createElement(TabContent, null, layers.map((geomapLayer, index) => index === activeTabIndex && (React.createElement("div", { key: geomapLayer.layer.getName() },
        React.createElement("div", null, geomapLayer.features.map((feature, idx) => {
            var _a;
            const key = (_a = feature.getId()) !== null && _a !== void 0 ? _a : idx;
            const shouldDisplayCollapse = geomapLayer.features.length > 1;
            return shouldDisplayCollapse ? (React.createElement(Collapse, { key: key, collapsible: true, label: generateLabel(feature, idx), isOpen: rowMap.get(key), onToggle: () => {
                    updateRowMap(key, !rowMap.get(key));
                }, className: styles.collapsibleRow },
                React.createElement(DataHoverRow, { feature: feature }))) : (React.createElement(DataHoverRow, { key: key, feature: feature }));
        })))))));
};
export const generateLabel = (feature, idx) => {
    const names = ['Name', 'name', 'Title', 'ID', 'id'];
    let props = feature.getProperties();
    let first = '';
    const frame = feature.get('frame'); // eslint-disable-line
    if (frame) {
        const rowIndex = feature.get('rowIndex');
        for (const f of frame.fields) {
            if (f.type === FieldType.string) {
                const k = getFieldDisplayName(f, frame);
                if (!first) {
                    first = k;
                }
                props[k] = f.values[rowIndex];
            }
        }
    }
    for (let k of names) {
        const v = props[k];
        if (v) {
            return v;
        }
    }
    if (first) {
        return (React.createElement("span", null,
            first,
            ": ",
            renderValue(props[first])));
    }
    for (let k of Object.keys(props)) {
        const v = props[k];
        if (isString(v)) {
            return (React.createElement("span", null,
                k,
                ": ",
                renderValue(v)));
        }
    }
    return `Match: ${idx + 1}`;
};
const getStyles = (theme) => ({
    collapsibleRow: css `
    margin-bottom: 0;
  `,
});
//# sourceMappingURL=DataHoverRows.js.map