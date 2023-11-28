import React from 'react';
import { LoadingState } from '@grafana/data';
import { useSelector } from 'app/types';
import { ErrorContainer } from './ErrorContainer';
export function ResponseErrorContainer(props) {
    const queryResponse = useSelector((state) => state.explore.panes[props.exploreId].queryResponse);
    const queryError = (queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.state) === LoadingState.Error ? queryResponse === null || queryResponse === void 0 ? void 0 : queryResponse.error : undefined;
    // Errors with ref ids are shown below the corresponding query
    if (queryError === null || queryError === void 0 ? void 0 : queryError.refId) {
        return null;
    }
    return React.createElement(ErrorContainer, { queryError: queryError });
}
//# sourceMappingURL=ResponseErrorContainer.js.map