import React from 'react';
import { useSelector } from 'react-redux';
import { LoadingState } from '@grafana/data';
import { ErrorContainer } from './ErrorContainer';
export function ResponseErrorContainer(props) {
    var queryResponse = useSelector(function (state) { var _a; return (_a = state.explore[props.exploreId]) === null || _a === void 0 ? void 0 : _a.queryResponse; });
    var queryError = (queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.state) === LoadingState.Error ? queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.error : undefined;
    return React.createElement(ErrorContainer, { queryError: queryError });
}
//# sourceMappingURL=ResponseErrorContainer.js.map