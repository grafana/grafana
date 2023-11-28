import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { Alert, HorizontalGroup, Icon, Select, useStyles2 } from '@grafana/ui';
import { getGeometryField, getLocationMatchers } from '../utils/location';
const MODE_OPTIONS = [
    {
        value: FrameGeometrySourceMode.Auto,
        label: 'Auto',
        ariaLabel: selectors.components.Transforms.SpatialOperations.location.autoOption,
        description: 'Automatically identify location data based on default field names',
    },
    {
        value: FrameGeometrySourceMode.Coords,
        label: 'Coords',
        ariaLabel: selectors.components.Transforms.SpatialOperations.location.coords.option,
        description: 'Specify latitude and longitude fields',
    },
    {
        value: FrameGeometrySourceMode.Geohash,
        label: 'Geohash',
        ariaLabel: selectors.components.Transforms.SpatialOperations.location.geohash.option,
        description: 'Specify geohash field',
    },
    {
        value: FrameGeometrySourceMode.Lookup,
        label: 'Lookup',
        ariaLabel: selectors.components.Transforms.SpatialOperations.location.lookup.option,
        description: 'Specify Gazetteer and lookup field',
    },
];
const helpUrl = 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/#location';
export const LocationModeEditor = ({ value, onChange, context, item, }) => {
    const [info, setInfo] = useState();
    useEffect(() => {
        var _a, _b, _c;
        if (((_a = item.settings) === null || _a === void 0 ? void 0 : _a.source) && ((_c = (_b = item.settings) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.length) && item.settings.data[0]) {
            getLocationMatchers(item.settings.source).then((location) => {
                if (item.settings && item.settings.data) {
                    setInfo(getGeometryField(item.settings.data[0], location));
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.settings]);
    const styles = useStyles2(getStyles);
    const dataValidation = () => {
        if (info) {
            if (info.warning) {
                return (React.createElement(Alert, { title: info.warning, severity: "warning", buttonContent: React.createElement(Icon, { name: "question-circle", size: "xl" }), className: styles.alert, onRemove: () => {
                        const newWindow = window.open(helpUrl, '_blank', 'noopener,noreferrer');
                        if (newWindow) {
                            newWindow.opener = null;
                        }
                    } }));
            }
            else if (value === FrameGeometrySourceMode.Auto && info.description) {
                return React.createElement("span", null, info.description);
            }
        }
        return null;
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { options: MODE_OPTIONS, value: value, onChange: (v) => {
                onChange(v.value);
            } }),
        React.createElement(HorizontalGroup, { className: styles.hGroup }, dataValidation())));
};
const getStyles = (theme) => {
    return {
        alert: css `
      & div {
        padding: 4px;
      }
      margin-bottom: 0px;
      margin-top: 5px;
      padding: 2px;
    `,
        // TODO apply styling to horizontal group (currently not working)
        hGroup: css `
      & div {
        width: 100%;
      }
    `,
    };
};
//# sourceMappingURL=locationModeEditor.js.map