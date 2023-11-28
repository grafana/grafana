import { render, screen } from '@testing-library/react';
import React from 'react';
import { PromRuleType } from 'app/types/unified-alerting-dto';
import GroupedView, { UNGROUPED_KEY } from './GroupedView';
describe('Grouped view', () => {
    const rules = [
        {
            promRule: {
                type: PromRuleType.Alerting,
                alerts: [
                    // @ts-ignore
                    { labels: { job: 'job-1', severity: 'high' } },
                    // @ts-ignore
                    { labels: { job: 'job-2', severity: 'low' } },
                ],
            },
        },
        {
            promRule: {
                type: PromRuleType.Alerting,
                alerts: [
                    // @ts-ignore
                    { labels: { foo: 'bar', severity: 'low' } },
                ],
            },
        },
    ];
    it('should group instances by label(s) correctly', () => {
        // @ts-ignore
        const options = {
            groupBy: ['job', 'severity'],
        };
        render(React.createElement(GroupedView, { rules: rules, options: options }));
        expect(screen.getByTestId('job=job-1&severity=high')).toBeInTheDocument();
        expect(screen.getByTestId('job=job-2&severity=low')).toBeInTheDocument();
        expect(screen.getByTestId(UNGROUPED_KEY)).toBeInTheDocument();
    });
});
//# sourceMappingURL=GroupedView.test.js.map