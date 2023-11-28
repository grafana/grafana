import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { byRole } from 'testing-library-selector';
import { LogRecordViewerByTimestamp } from './LogRecordViewer';
const ui = {
    log: byRole('list', { name: 'State history by timestamp' }),
};
describe('LogRecordViewerByTimestamp', () => {
    it('should group the same timestamps into one group', () => {
        const records = [
            { timestamp: 1681739580000, line: { current: 'Alerting', previous: 'Pending', labels: { foo: 'bar' } } },
            { timestamp: 1681739580000, line: { current: 'Alerting', previous: 'Pending', labels: { severity: 'warning' } } },
            { timestamp: 1681739600000, line: { current: 'Normal', previous: 'Alerting', labels: { foo: 'bar' } } },
            { timestamp: 1681739600000, line: { current: 'Normal', previous: 'Alerting', labels: { severity: 'warning' } } },
        ];
        render(React.createElement(LogRecordViewerByTimestamp, { records: records, commonLabels: [] }));
        const logElement = ui.log.get();
        expect(logElement).toBeInTheDocument();
        const entry1 = getByTestId(logElement, 1681739580000);
        const entry2 = getByTestId(logElement, 1681739600000);
        expect(entry1).toHaveTextContent('foo=bar');
        expect(entry1).toHaveTextContent('severity=warning');
        expect(entry2).toHaveTextContent('foo=bar');
        expect(entry2).toHaveTextContent('severity=warning');
    });
});
//# sourceMappingURL=LogRecordViewer.test.js.map