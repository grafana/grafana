import { render, screen } from '@testing-library/react';
import React from 'react';
import { RateSection, testIds } from './RateSection';
const onRunQuery = jest.fn();
const onChange = jest.fn();
const tsdbVersions = [
    { label: '<=2.1', value: 1 },
    { label: '==2.2', value: 2 },
    { label: '==2.3', value: 3 },
];
const setup = (tsdbVersion, propOverrides) => {
    const query = {
        metric: '',
        refId: 'A',
        downsampleAggregator: 'avg',
        downsampleFillPolicy: 'none',
    };
    const props = {
        query,
        onChange: onChange,
        onRunQuery: onRunQuery,
        tsdbVersion: tsdbVersion,
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(RateSection, Object.assign({}, props)));
};
describe('RateSection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should render the rate section', () => {
        setup(tsdbVersions[0].value);
        expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
    });
    describe('rate components', () => {
        it('should render the counter switch when rate is switched on', () => {
            setup(tsdbVersions[0].value, { query: { shouldComputeRate: true } });
            expect(screen.getByTestId(testIds.isCounter)).toBeInTheDocument();
        });
        it('should render the max count input when rate & counter are switched on', () => {
            setup(tsdbVersions[0].value, { query: { shouldComputeRate: true, isCounter: true } });
            expect(screen.getByTestId(testIds.counterMax)).toBeInTheDocument();
        });
    });
    describe('explicit tags', () => {
        it('should render explicit tags switch for tsdb versions > 2.2', () => {
            setup(tsdbVersions[2].value);
            expect(screen.getByText('Explicit tags')).toBeInTheDocument();
        });
        it('should not render explicit tags switch for tsdb versions <= 2.2', () => {
            setup(tsdbVersions[0].value);
            expect(screen.queryByText('Explicit tags')).toBeNull();
        });
    });
});
//# sourceMappingURL=RateSection.test.js.map