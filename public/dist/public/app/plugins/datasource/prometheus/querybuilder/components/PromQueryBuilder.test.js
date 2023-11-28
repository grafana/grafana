import { __awaiter } from "tslib";
import { getByText, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LoadingState, MutableDataFrame, } from '@grafana/data';
import { PrometheusDatasource } from '../../datasource';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { PromApplication } from '../../types';
import { getLabelSelects } from '../testUtils';
import { PromQueryBuilder } from './PromQueryBuilder';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';
const defaultQuery = {
    metric: 'random_metric',
    labels: [],
    operations: [],
};
const bugQuery = {
    metric: 'random_metric',
    labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
    operations: [
        {
            id: 'rate',
            params: ['auto'],
        },
        {
            id: '__sum_by',
            params: ['instance', 'job'],
        },
    ],
    binaryQueries: [
        {
            operator: '/',
            query: {
                metric: 'metric2',
                labels: [{ label: 'foo', op: '=', value: 'bar' }],
                operations: [
                    {
                        id: '__avg_by',
                        params: ['app'],
                    },
                ],
            },
        },
    ],
};
describe('PromQueryBuilder', () => {
    it('shows empty just with metric selected', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        // Add label
        expect(screen.getByLabelText('Add')).toBeInTheDocument();
        expect(screen.getByTitle('Add operation')).toBeInTheDocument();
    }));
    it('renders all the query sections', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(bugQuery);
        expect(screen.getByText('random_metric')).toBeInTheDocument();
        expect(screen.getByText('localhost:9090')).toBeInTheDocument();
        expect(screen.getByText('Rate')).toBeInTheDocument();
        const sumBys = screen.getAllByTestId('operations.1.wrapper');
        expect(getByText(sumBys[0], 'instance')).toBeInTheDocument();
        expect(getByText(sumBys[0], 'job')).toBeInTheDocument();
        const avgBys = screen.getAllByTestId('operations.0.wrapper');
        expect(getByText(avgBys[1], 'app')).toBeInTheDocument();
        expect(screen.getByText('Operator')).toBeInTheDocument();
        expect(screen.getByText('Vector matches')).toBeInTheDocument();
    }));
    it('tries to load metrics without labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const { languageProvider, container } = setup();
        yield openMetricSelect(container);
        yield waitFor(() => expect(languageProvider.getLabelValues).toBeCalledWith('__name__'));
    }));
    it('tries to load metrics with labels', () => __awaiter(void 0, void 0, void 0, function* () {
        const { languageProvider, container } = setup(Object.assign(Object.assign({}, defaultQuery), { labels: [{ label: 'label_name', op: '=', value: 'label_value' }] }));
        yield openMetricSelect(container);
        yield waitFor(() => expect(languageProvider.getSeries).toBeCalledWith('{label_name="label_value"}', true));
    }));
    it('tries to load variables in metric field', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource, container } = setup();
        datasource.getVariables = jest.fn().mockReturnValue([]);
        yield openMetricSelect(container);
        yield waitFor(() => expect(datasource.getVariables).toBeCalled());
    }));
    // <LegacyPrometheus>
    it('tries to load labels when metric selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const { languageProvider } = setup();
        yield openLabelNameSelect();
        yield waitFor(() => expect(languageProvider.fetchSeriesLabels).toBeCalledWith('{__name__="random_metric"}'));
    }));
    it('tries to load variables in label field', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = setup();
        datasource.getVariables = jest.fn().mockReturnValue([]);
        yield openLabelNameSelect();
        yield waitFor(() => expect(datasource.getVariables).toBeCalled());
    }));
    it('tries to load labels when metric selected and other labels are already present', () => __awaiter(void 0, void 0, void 0, function* () {
        const { languageProvider } = setup(Object.assign(Object.assign({}, defaultQuery), { labels: [
                { label: 'label_name', op: '=', value: 'label_value' },
                { label: 'foo', op: '=', value: 'bar' },
            ] }));
        yield openLabelNameSelect(1);
        yield waitFor(() => expect(languageProvider.fetchSeriesLabels).toBeCalledWith('{label_name="label_value", __name__="random_metric"}'));
    }));
    //</LegacyPrometheus>
    it('tries to load labels when metric is not selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const { languageProvider } = setup(Object.assign(Object.assign({}, defaultQuery), { metric: '' }));
        yield openLabelNameSelect();
        yield waitFor(() => expect(languageProvider.fetchLabels).toBeCalled());
    }));
    it('shows hints for histogram metrics', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = setup({
            metric: 'histogram_metric_bucket',
            labels: [],
            operations: [],
        });
        yield openMetricSelect(container);
        yield userEvent.click(screen.getByText('histogram_metric_bucket'));
        yield waitFor(() => expect(screen.getByText('hint: add histogram_quantile')).toBeInTheDocument());
    }));
    it('shows hints for counter metrics', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = setup({
            metric: 'histogram_metric_sum',
            labels: [],
            operations: [],
        });
        yield openMetricSelect(container);
        yield userEvent.click(screen.getByText('histogram_metric_sum'));
        yield waitFor(() => expect(screen.getByText('hint: add rate')).toBeInTheDocument());
    }));
    it('shows hints for counter metrics', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = setup({
            metric: 'histogram_metric_sum',
            labels: [],
            operations: [],
        });
        yield openMetricSelect(container);
        yield userEvent.click(screen.getByText('histogram_metric_sum'));
        yield waitFor(() => expect(screen.getByText('hint: add rate')).toBeInTheDocument());
    }));
    it('shows multiple hints', () => __awaiter(void 0, void 0, void 0, function* () {
        const data = {
            series: [],
            state: LoadingState.Done,
            timeRange: {},
        };
        for (let i = 0; i < 25; i++) {
            data.series.push(new MutableDataFrame());
        }
        const { container } = setup({
            metric: 'histogram_metric_sum',
            labels: [],
            operations: [],
        }, data);
        yield openMetricSelect(container);
        yield userEvent.click(screen.getByText('histogram_metric_sum'));
        yield waitFor(() => expect(screen.getAllByText(/hint:/)).toHaveLength(2));
    }));
    it('shows explain section when showExplain is true', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = createDatasource();
        const props = createProps(datasource);
        props.showExplain = true;
        render(React.createElement(PromQueryBuilder, Object.assign({}, props, { query: {
                metric: 'histogram_metric_sum',
                labels: [],
                operations: [],
            } })));
        expect(yield screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
    }));
    it('does not show explain section when showExplain is false', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = createDatasource();
        const props = createProps(datasource);
        render(React.createElement(PromQueryBuilder, Object.assign({}, props, { query: {
                metric: 'histogram_metric_sum',
                labels: [],
                operations: [],
            } })));
        expect(yield screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
    }));
    it('renders hint if initial hint provided', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = createDatasource();
        datasource.getInitHints = () => [
            {
                label: 'Initial hint',
                type: 'warning',
            },
        ];
        const props = createProps(datasource);
        render(React.createElement(PromQueryBuilder, Object.assign({}, props, { query: {
                metric: 'histogram_metric_sum',
                labels: [],
                operations: [],
            } })));
        expect(yield screen.queryByText('Initial hint')).toBeInTheDocument();
    }));
    it('renders no hint if no initial hint provided', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = createDatasource();
        datasource.getInitHints = () => [];
        const props = createProps(datasource);
        render(React.createElement(PromQueryBuilder, Object.assign({}, props, { query: {
                metric: 'histogram_metric_sum',
                labels: [],
                operations: [],
            } })));
        expect(yield screen.queryByText('Initial hint')).not.toBeInTheDocument();
    }));
    // <ModernPrometheus>
    it('tries to load labels when metric selected modern prom', () => __awaiter(void 0, void 0, void 0, function* () {
        const { languageProvider } = setup(undefined, undefined, {
            jsonData: { prometheusVersion: '2.38.1', prometheusType: PromApplication.Prometheus },
        });
        yield openLabelNameSelect();
        yield waitFor(() => expect(languageProvider.fetchSeriesLabelsMatch).toBeCalledWith('{__name__="random_metric"}'));
    }));
    it('tries to load variables in label field modern prom', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = setup(undefined, undefined, {
            jsonData: { prometheusVersion: '2.38.1', prometheusType: PromApplication.Prometheus },
        });
        datasource.getVariables = jest.fn().mockReturnValue([]);
        yield openLabelNameSelect();
        yield waitFor(() => expect(datasource.getVariables).toBeCalled());
    }));
    it('tries to load labels when metric selected and other labels are already present modern prom', () => __awaiter(void 0, void 0, void 0, function* () {
        const { languageProvider } = setup(Object.assign(Object.assign({}, defaultQuery), { labels: [
                { label: 'label_name', op: '=', value: 'label_value' },
                { label: 'foo', op: '=', value: 'bar' },
            ] }), undefined, { jsonData: { prometheusVersion: '2.38.1', prometheusType: PromApplication.Prometheus } });
        yield openLabelNameSelect(1);
        yield waitFor(() => expect(languageProvider.fetchSeriesLabelsMatch).toBeCalledWith('{label_name="label_value", __name__="random_metric"}'));
    }));
    //</ModernPrometheus>
});
function createDatasource(options) {
    const languageProvider = new EmptyLanguageProviderMock();
    const datasource = new PrometheusDatasource(Object.assign({ url: '', jsonData: {}, meta: {} }, options), undefined, undefined, languageProvider);
    return { datasource, languageProvider };
}
function createProps(datasource, data) {
    return {
        datasource,
        onRunQuery: () => { },
        onChange: () => { },
        data,
        showExplain: false,
    };
}
function setup(query = defaultQuery, data, datasourceOptionsOverride) {
    const { datasource, languageProvider } = createDatasource(datasourceOptionsOverride);
    const props = createProps(datasource, data);
    const { container } = render(React.createElement(PromQueryBuilder, Object.assign({}, props, { query: query })));
    return { languageProvider, datasource, container };
}
function openMetricSelect(container) {
    return __awaiter(this, void 0, void 0, function* () {
        const select = container.querySelector('#prometheus-metric-select');
        if (select) {
            yield userEvent.click(select);
        }
    });
}
function openLabelNameSelect(index = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name } = getLabelSelects(index);
        yield userEvent.click(name);
    });
}
//# sourceMappingURL=PromQueryBuilder.test.js.map