import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { contextSrv } from 'app/core/core';

import { QueryLibraryContextProviderMock } from '../QueryLibrary/mocks';

import { RichHistoryAddToLibrary } from './RichHistoryAddToLibrary';

describe('RichHistoryAddToLibrary', () => {
  it('should render button when save query is enabled', () => {
    contextSrv.isEditor = true;
    render(
      <QueryLibraryContextProviderMock queryLibraryEnabled={true}>
        <RichHistoryAddToLibrary query={{ refId: 'A' }} />
      </QueryLibraryContextProviderMock>
    );

    expect(screen.getByRole('button', { name: /Save query/i })).toBeInTheDocument();
  });
  it('should not render button when save query is disabled', () => {
    render(
      <QueryLibraryContextProviderMock queryLibraryEnabled={false}>
        <RichHistoryAddToLibrary query={{ refId: 'A' }} />
      </QueryLibraryContextProviderMock>
    );

    expect(screen.queryByRole('button', { name: /Save query/i })).not.toBeInTheDocument();
  });
  it('should not render button when user has Viewer role', () => {
    contextSrv.isEditor = false;
    render(
      <QueryLibraryContextProviderMock queryLibraryEnabled={true}>
        <RichHistoryAddToLibrary query={{ refId: 'A' }} />
      </QueryLibraryContextProviderMock>
    );

    expect(screen.queryByRole('button', { name: /Save query/i })).not.toBeInTheDocument();
  });
});
