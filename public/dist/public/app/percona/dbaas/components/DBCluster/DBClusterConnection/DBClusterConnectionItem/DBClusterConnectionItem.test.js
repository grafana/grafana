import { render } from '@testing-library/react';
import React from 'react';
import { DBClusterConnectionItem } from './DBClusterConnectionItem';
describe('DBClusterConnectionItem::', () => {
    it('renders correctly', () => {
        var _a;
        const { container } = render(React.createElement(DBClusterConnectionItem, { label: "Test", value: "test" }));
        expect(container.querySelectorAll('span')).toHaveLength(2);
        expect((_a = container.querySelector('div')) === null || _a === void 0 ? void 0 : _a.children).toHaveLength(2);
    });
    it('renders correctly label and value', () => {
        const { container } = render(React.createElement(DBClusterConnectionItem, { label: "test label", value: "test value" }));
        expect(container).toHaveTextContent('test label');
        expect(container).toHaveTextContent('test value');
    });
});
//# sourceMappingURL=DBClusterConnectionItem.test.js.map