import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LokiOptionFields } from './LokiOptionFields';
var setup = function (propOverrides) {
    var queryType = 'range';
    var lineLimitValue = '1';
    var onLineLimitChange = jest.fn();
    var onQueryTypeChange = jest.fn();
    var onKeyDownFunc = jest.fn();
    var props = {
        queryType: queryType,
        lineLimitValue: lineLimitValue,
        onLineLimitChange: onLineLimitChange,
        onQueryTypeChange: onQueryTypeChange,
        onKeyDownFunc: onKeyDownFunc,
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(LokiOptionFields, __assign({}, props)));
};
describe('LokiOptionFields', function () {
    it('should render step field', function () {
        setup();
        expect(screen.getByTestId('lineLimitField')).toBeInTheDocument();
    });
    it('should render query type field', function () {
        setup();
        expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
    });
});
//# sourceMappingURL=LokiOptionFields.test.js.map