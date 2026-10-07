import { renderHook, waitFor } from '@testing-library/react';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@grafana/runtime/internal', () => ({
  UserStorage: jest.fn().mockImplementation(() => ({
    getItem: mockGetItem,
    setItem: mockSetItem,
  })),
}));

const mockPublish = jest.fn();

jest.mock('app/core/app_events', () => ({
  appEvents: { publish: mockPublish },
}));

import { NotebooksFeedbackEvent } from './notebooksFeedbackEvent';
import { useTrackNotebookVisitForFeedback } from './useTrackNotebookVisitForFeedback';

describe('useTrackNotebookVisitForFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not publish the feedback event before the 5th visit', async () => {
    mockGetItem.mockResolvedValue('3');
    mockSetItem.mockResolvedValue(undefined);

    renderHook(() => useTrackNotebookVisitForFeedback());

    await waitFor(() => expect(mockSetItem).toHaveBeenCalledWith('feedback-toast-visit-count', '4'));
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('publishes the feedback event on the 5th visit', async () => {
    mockGetItem.mockResolvedValue('4');
    mockSetItem.mockResolvedValue(undefined);

    renderHook(() => useTrackNotebookVisitForFeedback());

    await waitFor(() => expect(mockSetItem).toHaveBeenCalledWith('feedback-toast-visit-count', '5'));
    expect(mockPublish).toHaveBeenCalledWith(expect.any(NotebooksFeedbackEvent));
  });

  it('publishes the feedback event again on the 10th visit', async () => {
    mockGetItem.mockResolvedValue('9');
    mockSetItem.mockResolvedValue(undefined);

    renderHook(() => useTrackNotebookVisitForFeedback());

    await waitFor(() => expect(mockSetItem).toHaveBeenCalledWith('feedback-toast-visit-count', '10'));
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('treats a missing stored value as the first visit without throwing', async () => {
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);

    renderHook(() => useTrackNotebookVisitForFeedback());

    await waitFor(() => expect(mockSetItem).toHaveBeenCalledWith('feedback-toast-visit-count', '1'));
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('treats an unparseable stored value as the first visit', async () => {
    mockGetItem.mockResolvedValue('not-a-number');
    mockSetItem.mockResolvedValue(undefined);

    renderHook(() => useTrackNotebookVisitForFeedback());

    await waitFor(() => expect(mockSetItem).toHaveBeenCalledWith('feedback-toast-visit-count', '1'));
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
