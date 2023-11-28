import { render } from '@testing-library/react';
import React from 'react';
import { ContainerLogs } from './ContainerLogs';
describe('ContainerLogs::', () => {
    it('renders container name and logs', () => {
        const { container } = render(React.createElement(ContainerLogs, { containerLogs: {
                name: 'Test',
                isOpen: true,
                logs: 'Test logs',
            } }));
        expect(container.querySelector('div > div > div > div ')).toHaveTextContent('Test');
        expect(container.querySelector('pre')).toHaveTextContent('Test logs');
    });
    it("does't render logs when collapsed", () => {
        const { container } = render(React.createElement(ContainerLogs, { containerLogs: {
                name: 'Test',
                isOpen: false,
                logs: 'Test logs',
            } }));
        expect(container.querySelector('pre')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=ContainerLogs.test.js.map