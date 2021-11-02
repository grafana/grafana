import React from 'react';
import Loadable from 'react-loadable';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';
import { ErrorLoadingChunk } from './ErrorLoadingChunk';
export var loadComponentHandler = function (props) {
    var error = props.error, pastDelay = props.pastDelay;
    if (error) {
        return React.createElement(ErrorLoadingChunk, { error: error });
    }
    if (pastDelay) {
        return React.createElement(LoadingChunkPlaceHolder, null);
    }
    return null;
};
export var SafeDynamicImport = function (loader) {
    return Loadable({
        loader: loader,
        loading: loadComponentHandler,
    });
};
//# sourceMappingURL=SafeDynamicImport.js.map