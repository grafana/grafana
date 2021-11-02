import React from 'react';
import { loadComponentHandler } from './SafeDynamicImport';
import { ErrorLoadingChunk } from './ErrorLoadingChunk';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';
describe('loadComponentHandler', function () {
    describe('when there is no error and pastDelay is false', function () {
        it('then it should return null', function () {
            var error = null;
            var pastDelay = false;
            var element = loadComponentHandler({ error: error, pastDelay: pastDelay });
            expect(element).toBe(null);
        });
    });
    describe('when there is an error', function () {
        it('then it should return ErrorLoadingChunk', function () {
            var error = new Error('Some chunk failed to load');
            var pastDelay = false;
            var element = loadComponentHandler({ error: error, pastDelay: pastDelay });
            expect(element).toEqual(React.createElement(ErrorLoadingChunk, { error: error }));
        });
    });
    describe('when loading is taking more then default delay of 200ms', function () {
        it('then it should return LoadingChunkPlaceHolder', function () {
            var error = null;
            var pastDelay = true;
            var element = loadComponentHandler({ error: error, pastDelay: pastDelay });
            expect(element).toEqual(React.createElement(LoadingChunkPlaceHolder, null));
        });
    });
});
//# sourceMappingURL=SafeDynamicImport.test.js.map