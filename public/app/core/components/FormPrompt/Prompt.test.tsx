import { History, Location, createMemoryHistory } from 'history';
import { ReactElement } from 'react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { Prompt } from './Prompt';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(),
    getHistory: jest.fn(),
  },
}));

describe('Prompt component with React Router', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;
  let mockHistory: History & { block: jest.Mock };

  beforeEach(() => {
    addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const historyInstance = createMemoryHistory({ initialEntries: ['/current'] });
    mockHistory = {
      ...historyInstance,
      block: jest.fn(() => jest.fn()) as jest.Mock,
    };

    (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/current' } as Location);
    (locationService.getHistory as jest.Mock).mockReturnValue(mockHistory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRouter = (ui: ReactElement) => {
    return render(ui);
  };

  it('should add and remove event listeners when `when` is true', () => {
    const { unmount } = renderWithRouter(<Prompt when={true} message="Are you sure you want to leave?" />);

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(mockHistory.block).toHaveBeenCalled();
  });

  it('should not add event listeners when `when` is false', () => {
    const { unmount } = renderWithRouter(<Prompt when={false} message="Are you sure you want to leave?" />);

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    expect(removeEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(mockHistory.block).not.toHaveBeenCalled();
  });

  it('should use the message function if provided', async () => {
    const messageFn = jest.fn().mockReturnValue('Custom message');
    renderWithRouter(<Prompt when={true} message={messageFn} />);

    const callback = mockHistory.block.mock.calls[0][0];
    callback({ pathname: '/new-path' } as Location);

    expect(messageFn).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/new-path' }));
  });
});
