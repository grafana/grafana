import { History, Location, createMemoryHistory } from 'history';
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
  let mockHistory: History & { block: jest.Mock };

  beforeEach(() => {
    const historyInstance = createMemoryHistory({ initialEntries: ['/current'] });
    mockHistory = {
      ...historyInstance,
      block: jest.fn(() => jest.fn()),
    };

    (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/current' } as Location);
    (locationService.getHistory as jest.Mock).mockReturnValue(mockHistory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call the block function when `when` is true', () => {
    const { unmount } = render(<Prompt when={true} message="Are you sure you want to leave?" />);

    unmount();
    expect(mockHistory.block).toHaveBeenCalled();
  });

  it('should not call the block function when `when` is false', () => {
    const { unmount } = render(<Prompt when={false} message="Are you sure you want to leave?" />);

    unmount();
    expect(mockHistory.block).not.toHaveBeenCalled();
  });

  it('should use the message function if provided', async () => {
    const messageFn = jest.fn().mockReturnValue('Custom message');
    render(<Prompt when={true} message={messageFn} />);

    const callback = mockHistory.block.mock.calls[0][0];
    callback({ pathname: '/new-path' } as Location);

    expect(messageFn).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/new-path' }));
  });
});
