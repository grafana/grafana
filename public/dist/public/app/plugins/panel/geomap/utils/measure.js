import { getValueFormat, toFixedUnit } from '@grafana/data';
export const measures = [
    {
        value: 'length',
        label: 'Length',
        geometry: 'LineString',
        units: [
            {
                label: 'Metric (m/km)',
                value: 'm',
                format: (m) => getValueFormat('lengthm')(m),
            },
            {
                label: 'Feet (ft)',
                value: 'ft',
                format: (m) => getValueFormat('lengthft')(m * 3.28084),
            },
            {
                label: 'Miles (mi)',
                value: 'mi',
                format: (m) => getValueFormat('lengthmi')(m / 1609.0),
            },
            {
                label: 'Nautical miles (nmi)',
                value: 'nmi',
                format: (m) => getValueFormat('nmi')(m / 1852.0),
            },
        ],
        getUnit: (v) => {
            var _a;
            const units = measures[0].units;
            if (v === null || v === void 0 ? void 0 : v.endsWith('2')) {
                v = v.substring(0, v.length - 1);
            }
            return (_a = units.find((u) => u.value === v)) !== null && _a !== void 0 ? _a : units[0];
        },
    },
    {
        value: 'area',
        label: 'Area',
        geometry: 'Polygon',
        units: [
            {
                label: 'Square Meters (m²)',
                value: 'm2',
                format: (m2) => getValueFormat('areaM2')(m2),
            },
            {
                label: 'Square Kilometers (km²)',
                value: 'km2',
                format: (m2) => toFixedUnit('km²')(m2 * 1e-6),
            },
            {
                label: 'Square Feet (ft²)',
                value: 'ft2',
                format: (m2) => getValueFormat('areaF2')(m2 * 10.76391),
            },
            {
                label: 'Square Miles (mi²)',
                value: 'mi2',
                format: (m2) => getValueFormat('areaMI2')(m2 * 3.861e-7),
            },
            {
                label: 'Acres',
                value: 'acre2',
                format: (m2) => toFixedUnit('acre')(m2 * 2.47105e-4),
            },
            {
                label: 'Hectare',
                value: 'hectare2',
                format: (m2) => toFixedUnit('ha')(m2 * 1e-4),
            },
        ],
        getUnit: (v) => {
            var _a;
            const units = measures[1].units;
            if (!(v === null || v === void 0 ? void 0 : v.endsWith('2'))) {
                v += '2';
            }
            return (_a = units.find((u) => u.value === v)) !== null && _a !== void 0 ? _a : units[0];
        },
    },
];
//# sourceMappingURL=measure.js.map