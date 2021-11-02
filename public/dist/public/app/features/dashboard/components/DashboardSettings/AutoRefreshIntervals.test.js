import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultIntervals } from '@grafana/ui';
import { AutoRefreshIntervals, getValidIntervals, validateIntervals } from './AutoRefreshIntervals';
var setupTestContext = function (options) {
    var defaults = {
        refreshIntervals: ['1s', '5s', '10s'],
        onRefreshIntervalChange: jest.fn(),
        getIntervalsFunc: function (intervals) { return intervals; },
        validateIntervalsFunc: function () { return null; },
    };
    var props = __assign(__assign({}, defaults), options);
    var rerender = render(React.createElement(AutoRefreshIntervals, __assign({}, props))).rerender;
    return { rerender: rerender, props: props };
};
describe('AutoRefreshIntervals', function () {
    describe('when component is mounted with refreshIntervals', function () {
        it('then supplied intervals should be shown', function () {
            setupTestContext({ getIntervalsFunc: function () { return ['5s', '10s']; } }); // remove 1s entry to validate we're calling getIntervalsFunc
            expect(screen.getByRole('textbox')).toHaveValue('5s,10s');
        });
    });
    describe('when component is mounted without refreshIntervals', function () {
        it('then default intervals should be shown', function () {
            setupTestContext({ refreshIntervals: null });
            expect(screen.getByRole('textbox')).toHaveValue('5s,10s,30s,1m,5m,15m,30m,1h,2h,1d');
        });
    });
    describe('when component is updated from Angular', function () {
        it('then intervals should be updated', function () {
            var _a = setupTestContext({}), rerender = _a.rerender, props = _a.props;
            var newProps = __assign(__assign({}, props), { renderCount: 1, refreshIntervals: ['2s', '6s', '11s'] });
            rerender(React.createElement(AutoRefreshIntervals, __assign({}, newProps)));
            expect(screen.getByRole('textbox')).toHaveValue('2s,6s,11s');
        });
    });
    describe('when input loses focus and intervals are valid', function () {
        it('then onRefreshIntervalChange should be called', function () {
            var props = setupTestContext({ validateIntervalsFunc: function () { return null; } }).props;
            userEvent.type(screen.getByRole('textbox'), ',30s');
            userEvent.tab();
            expect(screen.getByRole('textbox')).toHaveValue('1s,5s,10s,30s');
            expect(props.onRefreshIntervalChange).toHaveBeenCalledTimes(1);
            expect(props.onRefreshIntervalChange).toHaveBeenCalledWith(['1s', '5s', '10s', '30s']);
        });
    });
    describe('when input loses focus and intervals are invalid', function () {
        it('then onRefreshIntervalChange should not be called', function () {
            var props = setupTestContext({ validateIntervalsFunc: function () { return 'Not valid'; } }).props;
            userEvent.type(screen.getByRole('textbox'), ',30q');
            userEvent.tab();
            expect(screen.getByRole('textbox')).toHaveValue('1s,5s,10s,30q');
            expect(props.onRefreshIntervalChange).toHaveBeenCalledTimes(0);
        });
    });
    describe('when input loses focus and previous intervals were invalid', function () {
        it('then onRefreshIntervalChange should be called', function () {
            var validateIntervalsFunc = jest.fn().mockReturnValueOnce('Not valid').mockReturnValue(null);
            var props = setupTestContext({ validateIntervalsFunc: validateIntervalsFunc }).props;
            userEvent.type(screen.getByRole('textbox'), ',30q');
            userEvent.tab();
            userEvent.type(screen.getByRole('textbox'), '{backspace}s');
            userEvent.tab();
            expect(screen.getByRole('textbox')).toHaveValue('1s,5s,10s,30s');
            expect(props.onRefreshIntervalChange).toHaveBeenCalledTimes(1);
            expect(props.onRefreshIntervalChange).toHaveBeenCalledWith(['1s', '5s', '10s', '30s']);
        });
    });
});
describe('getValidIntervals', function () {
    describe('when called with empty intervals', function () {
        it('then is should all non empty intervals', function () {
            var emptyIntervals = ['', '5s', ' ', '10s', '  '];
            var dependencies = {
                getTimeSrv: function () {
                    return ({
                        getValidIntervals: function (intervals) { return intervals; },
                    });
                },
            };
            var result = getValidIntervals(emptyIntervals, dependencies);
            expect(result).toEqual(['5s', '10s']);
        });
    });
    describe('when called with duplicate intervals', function () {
        it('then is should return no duplicates', function () {
            var duplicateIntervals = ['5s', '10s', '1m', '5s', '30s', '10s', '5s', '2m'];
            var dependencies = {
                getTimeSrv: function () {
                    return ({
                        getValidIntervals: function (intervals) { return intervals; },
                    });
                },
            };
            var result = getValidIntervals(duplicateIntervals, dependencies);
            expect(result).toEqual(['5s', '10s', '1m', '30s', '2m']);
        });
    });
    describe('when called with untrimmed intervals', function () {
        it('then is should return trimmed intervals', function () {
            var duplicateIntervals = [' 5s', '10s ', ' 1m ', ' 3 0 s ', '   2      m     '];
            var dependencies = {
                getTimeSrv: function () {
                    return ({
                        getValidIntervals: function (intervals) { return intervals; },
                    });
                },
            };
            var result = getValidIntervals(duplicateIntervals, dependencies);
            expect(result).toEqual(['5s', '10s', '1m', '30s', '2m']);
        });
    });
});
describe('validateIntervals', function () {
    describe('when getValidIntervals does not throw', function () {
        it('then it should return null', function () {
            var dependencies = {
                getTimeSrv: function () {
                    return ({
                        getValidIntervals: function (intervals) { return intervals; },
                    });
                },
            };
            var result = validateIntervals(defaultIntervals, dependencies);
            expect(result).toBe(null);
        });
    });
    describe('when getValidIntervals throws', function () {
        it('then it should return the exception message', function () {
            var dependencies = {
                getTimeSrv: function () {
                    return ({
                        getValidIntervals: function () {
                            throw new Error('Some error');
                        },
                    });
                },
            };
            var result = validateIntervals(defaultIntervals, dependencies);
            expect(result).toEqual('Some error');
        });
    });
});
//# sourceMappingURL=AutoRefreshIntervals.test.js.map