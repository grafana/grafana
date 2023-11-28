import { render, screen } from '@testing-library/react';
import React from 'react';
import { RawPrometheusListItemEmptyValue } from '../utils/getRawPrometheusListItemsFromDataFrame';
import { ItemValues } from './ItemValues';
const value1 = 'value 1';
const value2 = 'value 2';
const defaultProps = {
    totalNumberOfValues: 3,
    values: [
        {
            key: 'Value #A',
            value: value1,
        },
        {
            key: 'Value #B',
            value: value2,
        },
        {
            key: 'Value #C',
            value: RawPrometheusListItemEmptyValue, // Empty value
        },
    ],
    hideFieldsWithoutValues: false,
};
describe('ItemValues', () => {
    it('should render values, with empty values', () => {
        var _a, _b, _c, _d, _e;
        const itemValues = render(React.createElement(ItemValues, Object.assign({}, defaultProps)));
        expect(screen.getByText(value1)).toBeVisible();
        expect(screen.getByText(value2)).toBeVisible();
        expect((_e = (_d = (_c = (_b = (_a = itemValues === null || itemValues === void 0 ? void 0 : itemValues.baseElement) === null || _a === void 0 ? void 0 : _a.children) === null || _b === void 0 ? void 0 : _b.item(0)) === null || _c === void 0 ? void 0 : _c.children) === null || _d === void 0 ? void 0 : _d.item(0)) === null || _e === void 0 ? void 0 : _e.children.length).toBe(3);
    });
    it('should render values, without empty values', () => {
        var _a, _b, _c, _d, _e;
        const props = Object.assign(Object.assign({}, defaultProps), { hideFieldsWithoutValues: true });
        const itemValues = render(React.createElement(ItemValues, Object.assign({}, props)));
        expect(screen.getByText(value1)).toBeVisible();
        expect(screen.getByText(value2)).toBeVisible();
        expect((_e = (_d = (_c = (_b = (_a = itemValues === null || itemValues === void 0 ? void 0 : itemValues.baseElement) === null || _a === void 0 ? void 0 : _a.children) === null || _b === void 0 ? void 0 : _b.item(0)) === null || _c === void 0 ? void 0 : _c.children) === null || _d === void 0 ? void 0 : _d.item(0)) === null || _e === void 0 ? void 0 : _e.children.length).toBe(2);
    });
});
//# sourceMappingURL=ItemValues.test.js.map