import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PromExploreExtraField } from './PromExploreExtraField';
var setup = function (propOverrides) {
    var query = { exemplar: false };
    var datasource = {};
    var onChange = jest.fn();
    var onRunQuery = jest.fn();
    var props = {
        onChange: onChange,
        onRunQuery: onRunQuery,
        query: query,
        datasource: datasource,
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(PromExploreExtraField, __assign({}, props)));
};
describe('PromExploreExtraField', function () {
    it('should render step field', function () {
        setup();
        expect(screen.getByTestId('stepField')).toBeInTheDocument();
    });
    it('should render query type field', function () {
        setup();
        expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
    });
});
//# sourceMappingURL=PromExploreExtraField.test.js.map