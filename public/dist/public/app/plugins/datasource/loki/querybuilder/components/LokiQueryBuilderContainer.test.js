import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { addOperation } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList.testUtils';
import { LokiDatasource } from '../../datasource';
import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';
describe('LokiQueryBuilderContainer', () => {
    it('translates query between string and model', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = {
            query: {
                expr: '{job="testjob"}',
                refId: 'A',
            },
            datasource: new LokiDatasource({
                id: 1,
                uid: '',
                type: 'loki',
                name: 'loki-test',
                access: 'proxy',
                url: '',
                jsonData: {},
                meta: {},
                readOnly: false,
            }, undefined, undefined),
            onChange: jest.fn(),
            onRunQuery: () => { },
            showExplain: false,
        };
        props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
        render(React.createElement(LokiQueryBuilderContainer, Object.assign({}, props)));
        const selector = yield screen.findByLabelText('selector');
        expect(selector.textContent).toBe('{job="testjob"}');
        yield addOperation('Range functions', 'Rate');
        expect(yield screen.findByText('Rate')).toBeInTheDocument();
        expect(props.onChange).toBeCalledWith({
            expr: 'rate({job="testjob"} [$__auto])',
            refId: 'A',
        });
    }));
});
//# sourceMappingURL=LokiQueryBuilderContainer.test.js.map