import React from 'react';
import { loadComponentHandler } from './SafeDynamicImport';
import { ErrorLoadingChunk } from './ErrorLoadingChunk';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';

describe('loadComponentHandler', () => {
  describe('when there is no error and pastDelay is false', () => {
    it('then it should return null', () => {
      const error: Error | null = null;
      const pastDelay = false;
      const element = loadComponentHandler({ error: (error as unknown) as Error, pastDelay });

      expect(element).toBe(null);
    });
  });

  describe('when there is an error', () => {
    it('then it should return ErrorLoadingChunk', () => {
      const error: Error = new Error('Some chunk failed to load');
      const pastDelay = false;
      const element = loadComponentHandler({ error, pastDelay });

      expect(element).toEqual(<ErrorLoadingChunk error={error} />);
    });
  });

  describe('when loading is taking more then default delay of 200ms', () => {
    it('then it should return LoadingChunkPlaceHolder', () => {
      const error: Error | null = null;
      const pastDelay = true;
      const element = loadComponentHandler({ error: (error as unknown) as Error, pastDelay });

      expect(element).toEqual(<LoadingChunkPlaceHolder />);
    });
  });
});
