import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LoadingState } from '@grafana/data';
import { TracesPanel } from './TracesPanel';
describe('TracesPanel', () => {
    it('shows no data message when no data supplied', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = {
            data: {
                error: undefined,
                series: [],
                state: LoadingState.Done,
            },
        };
        render(React.createElement(TracesPanel, Object.assign({}, props)));
        yield screen.findByText('No data found in response');
    }));
});
//# sourceMappingURL=TracesPanel.test.js.map