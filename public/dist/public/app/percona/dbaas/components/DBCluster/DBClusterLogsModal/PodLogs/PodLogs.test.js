import { render, screen } from '@testing-library/react';
import React from 'react';
import { PodLogs } from './PodLogs';
describe('PodLogs::', () => {
    it('renders pod name, events and containers', () => {
        const { container } = render(React.createElement(PodLogs, { podLogs: {
                name: 'Pod name',
                isOpen: true,
                events: 'Test events',
                containers: [
                    {
                        name: 'Test container 1',
                        isOpen: true,
                        logs: 'Test logs',
                    },
                    {
                        name: 'Test container 2',
                        isOpen: false,
                        logs: 'Test logs',
                    },
                ],
            } }));
        expect(container).toHaveTextContent('Pod name');
        expect(screen.getByTestId('dbcluster-pod-events')).toHaveTextContent('Test events');
        expect(screen.getByTestId('dbcluster-containers').children).toHaveLength(2);
    });
    it("doesn't render logs when collapsed", () => {
        render(React.createElement(PodLogs, { podLogs: {
                name: 'Pod name',
                isOpen: false,
                events: 'Test events',
                containers: [
                    {
                        name: 'Test container 1',
                        isOpen: true,
                        logs: 'Test logs',
                    },
                ],
            } }));
        expect(screen.queryByTestId('dbcluster-pod-events')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dbcluster-containers')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=PodLogs.test.js.map