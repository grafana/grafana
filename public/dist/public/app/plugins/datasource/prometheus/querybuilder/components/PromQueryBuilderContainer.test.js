import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { addOperation } from '../shared/OperationList.testUtils';
import { getOperationParamId } from '../shared/operationUtils';
import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';
describe('PromQueryBuilderContainer', () => {
    it('translates query between string and model', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup({ expr: 'rate(metric_test{job="testjob"}[$__rate_interval])' });
        expect(screen.getByText('metric_test')).toBeInTheDocument();
        yield addOperation('Range functions', 'Rate');
        expect(props.onChange).toBeCalledWith({
            expr: 'rate(metric_test{job="testjob"}[$__rate_interval])',
            refId: 'A',
        });
    }));
    it('Can add rest param', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = setup({ expr: 'sum(ALERTS)' });
        yield userEvent.click(screen.getByTestId('operations.0.add-rest-param'));
        waitFor(() => {
            expect(container.querySelector(`${getOperationParamId('0', 0)}`)).toBeInTheDocument();
        });
    }));
});
function setup(queryOverrides = {}) {
    const languageProvider = new EmptyLanguageProviderMock();
    const datasource = new PrometheusDatasource({
        url: '',
        jsonData: {},
        meta: {},
    }, undefined, undefined, languageProvider);
    const props = {
        datasource,
        query: Object.assign({ refId: 'A', expr: '' }, queryOverrides),
        onRunQuery: jest.fn(),
        onChange: jest.fn(),
        showExplain: false,
    };
    const { container } = render(React.createElement(PromQueryBuilderContainer, Object.assign({}, props)));
    return { languageProvider, datasource, container, props };
}
//# sourceMappingURL=PromQueryBuilderContainer.test.js.map