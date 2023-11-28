import { render } from '@testing-library/react';
import React from 'react';
import RawListItemAttributes from './RawListItemAttributes';
const getDefaultProps = (override) => {
    const key = 'key';
    const value = 'value';
    return Object.assign({ value: {
            key: key,
            value: value,
        }, index: 0, length: 0, isExpandedView: false }, override);
};
describe('RawListItemAttributes', () => {
    it('should render collapsed', () => {
        const props = getDefaultProps({ isExpandedView: false });
        const attributeRow = render(React.createElement(RawListItemAttributes, Object.assign({}, props)));
        expect(attributeRow.getByText(props.value.value)).toBeVisible();
        expect(attributeRow.getByText(props.value.key)).toBeVisible();
        expect(attributeRow.baseElement.textContent).toEqual(`${props.value.key}="${props.value.value}"`);
    });
    it('should render expanded', () => {
        const props = getDefaultProps({ isExpandedView: true });
        const attributeRow = render(React.createElement(RawListItemAttributes, Object.assign({}, props)));
        expect(attributeRow.getByText(props.value.value)).toBeVisible();
        expect(attributeRow.getByText(props.value.key)).toBeVisible();
        expect(attributeRow.baseElement.textContent).toEqual(`${props.value.key}="${props.value.value}"`);
    });
});
//# sourceMappingURL=RawListItemAttributes.test.js.map