import { render, screen } from '@testing-library/react';
import React from 'react';
import { Icon } from '@grafana/ui';
import { WarningBlock } from './WarningBlock';
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { Icon: jest.fn(() => React.createElement("div", null)) })));
describe('WarningBlock', () => {
    it('should have warning icon and message', () => {
        render(React.createElement(WarningBlock, { message: "message" }));
        expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'info-circle' }), expect.anything());
        expect(screen.getByTestId('warning-block')).toHaveTextContent('message');
    });
});
//# sourceMappingURL=WarningBlock.test.js.map