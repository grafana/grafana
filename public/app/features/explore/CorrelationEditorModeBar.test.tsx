import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { CORRELATION_EDITOR_POST_CONFIRM_ACTION, type ExploreItemState, type ExploreState } from 'app/types/explore';

import { CorrelationEditorModeBar } from './CorrelationEditorModeBar';
import { changeDatasource } from './state/datasource';

jest.mock('./state/datasource', () => ({
  ...jest.requireActual('./state/datasource'),
  changeDatasource: jest.fn(),
}));
jest.mock('./state/correlations', () => ({
  ...jest.requireActual('./state/correlations'),
  saveCurrentCorrelation: jest.fn(() => ({ type: 'mock/saveCurrentCorrelation' })),
}));
jest.mock('./state/query', () => ({
  ...jest.requireActual('./state/query'),
  runQueries: jest.fn(() => ({ type: 'mock/runQueries' })),
}));
jest.mock('./state/explorePane', () => ({
  ...jest.requireActual('./state/explorePane'),
  changeCorrelationHelperData: jest.fn(() => ({ type: 'mock/changeCorrelationHelperData' })),
}));

const changeDatasourceMock = jest.mocked(changeDatasource);
const CHANGE_DATASOURCE_ACTION = { type: 'mock/changeDatasource' };

describe('CorrelationEditorModeBar', () => {
  beforeEach(() => {
    changeDatasourceMock.mockReturnValue(CHANGE_DATASOURCE_ACTION as unknown as ReturnType<typeof changeDatasource>);
  });

  // Regression test (2026-07-02 DataPro code audit, finding #15): saving from the unsaved-changes
  // modal while a datasource change is pending must actually apply the datasource change. The
  // `changeDatasource` thunk was created but never dispatched, so the change was silently dropped.
  it('dispatches changeDatasource when saving with a pending datasource change', () => {
    const store = configureStore({
      explore: {
        panes: { left: {} },
        correlationEditorDetails: {
          editorMode: true,
          isExiting: true,
          correlationDirty: true,
          queryEditorDirty: false,
          canSave: true,
          label: 'my correlation',
          description: 'desc',
          postConfirmAction: {
            exploreId: 'left',
            action: CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE,
            changeDatasourceUid: 'new-ds-uid',
            isActionLeft: true,
          },
        },
      } as unknown as ExploreState,
    });
    const dispatchSpy = jest.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <CorrelationEditorModeBar panes={[['left', {} as ExploreItemState]]} />
      </Provider>
    );

    // The unsaved-changes modal appears because a datasource change is pending with a dirty correlation.
    fireEvent.click(screen.getByRole('button', { name: /save correlation/i }));

    expect(changeDatasourceMock).toHaveBeenCalledWith({ exploreId: 'left', datasource: 'new-ds-uid' });
    expect(dispatchSpy).toHaveBeenCalledWith(CHANGE_DATASOURCE_ACTION);
  });
});
