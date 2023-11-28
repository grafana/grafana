import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';
import { ElasticDetails } from './ElasticDetails';
import { createDefaultConfigOptions } from './mocks';
describe('ElasticDetails', () => {
    describe('Max concurrent Shard Requests', () => {
        it('should render "Max concurrent Shard Requests" ', () => {
            render(React.createElement(ElasticDetails, { onChange: () => { }, value: createDefaultConfigOptions() }));
            expect(screen.getByLabelText('Max concurrent Shard Requests')).toBeInTheDocument();
        });
    });
    it('should change database on interval change when not set explicitly', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeMock = jest.fn();
        render(React.createElement(ElasticDetails, { onChange: onChangeMock, value: createDefaultConfigOptions() }));
        const selectEl = screen.getByLabelText('Pattern');
        yield selectEvent.select(selectEl, 'Daily', { container: document.body });
        expect(onChangeMock).toHaveBeenLastCalledWith(expect.objectContaining({
            jsonData: expect.objectContaining({ interval: 'Daily', index: '[logstash-]YYYY.MM.DD' }),
        }));
    }));
    it('should change database on interval change if pattern is from example', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeMock = jest.fn();
        const options = createDefaultConfigOptions();
        options.database = '[logstash-]YYYY.MM.DD.HH';
        render(React.createElement(ElasticDetails, { onChange: onChangeMock, value: options }));
        const selectEl = screen.getByLabelText('Pattern');
        yield selectEvent.select(selectEl, 'Monthly', { container: document.body });
        expect(onChangeMock).toHaveBeenLastCalledWith(expect.objectContaining({
            jsonData: expect.objectContaining({ interval: 'Monthly', index: '[logstash-]YYYY.MM' }),
        }));
    }));
});
//# sourceMappingURL=ElasticDetails.test.js.map