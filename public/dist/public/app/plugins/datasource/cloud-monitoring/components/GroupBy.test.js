import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { openMenu, select } from 'react-select-event';
import { createMockTimeSeriesList } from '../__mocks__/cloudMonitoringQuery';
import { GroupBy } from './GroupBy';
const props = {
    onChange: jest.fn(),
    refId: 'refId',
    metricDescriptor: {
        valueType: '',
        metricKind: '',
    },
    variableOptionGroup: { options: [] },
    labels: [],
    query: createMockTimeSeriesList(),
};
describe('GroupBy', () => {
    it('renders group by fields', () => {
        render(React.createElement(GroupBy, Object.assign({}, props)));
        expect(screen.getByLabelText('Group by')).toBeInTheDocument();
        expect(screen.getByLabelText('Group by function')).toBeInTheDocument();
    });
    it('can select a group by', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(GroupBy, Object.assign({}, props, { onChange: onChange })));
        const groupBy = screen.getByLabelText('Group by');
        const option = 'metadata.system_labels.cloud_account';
        expect(screen.queryByText(option)).not.toBeInTheDocument();
        yield openMenu(groupBy);
        expect(screen.getByText(option)).toBeInTheDocument();
        yield select(groupBy, option, { container: document.body });
        expect(onChange).toBeCalledWith(expect.objectContaining({ groupBys: expect.arrayContaining([option]) }));
    }));
});
//# sourceMappingURL=GroupBy.test.js.map