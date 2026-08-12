import { act, render, screen } from '@testing-library/react';
import type Map from 'ol/Map';

import { selectors } from '@grafana/e2e-selectors';

import { createMockMap } from '../__fixtures__/olMapMock';

import { DebugOverlay } from './DebugOverlay';

jest.mock('ol/proj', () => ({
  transform: jest.fn((coord) => coord),
}));

describe('DebugOverlay', () => {
  it('should render zoom and center from the initial view state', () => {
    const { map } = createMockMap({ zoom: 4.567, center: [10, 20] });
    render(<DebugOverlay map={map as unknown as Map} />);

    expect(screen.getByText('4.6')).toBeInTheDocument();
    expect(screen.getByText(/10\.[0]+, 20\.[0]+/)).toBeInTheDocument();
  });

  it('should subscribe to moveend on mount and update text when it fires', () => {
    const mock = createMockMap({ zoom: 1, center: [0, 0] });
    render(<DebugOverlay map={mock.map as unknown as Map} />);

    expect(mock.map.on).toHaveBeenCalledWith('moveend', expect.any(Function));
    expect(screen.getByText('1.0')).toBeInTheDocument();

    mock.setView({ zoom: 7.21, center: [-122, 47] });
    act(() => {
      mock.fire('moveend');
    });

    expect(screen.getByText('7.2')).toBeInTheDocument();
    expect(screen.getByText(/-122\.[0]+0, 47\.[0]+/)).toBeInTheDocument();
  });

  it('should unsubscribe from moveend on unmount', () => {
    const { map } = createMockMap({ zoom: 1, center: [0, 0] });
    const { unmount } = render(<DebugOverlay map={map as unknown as Map} />);

    const handler = map.on.mock.calls.find((call) => call[0] === 'moveend')?.[1];
    expect(handler).toBeDefined();

    unmount();

    expect(map.un).toHaveBeenCalledWith('moveend', handler);
  });

  it('should expose the documented testid', () => {
    const { map } = createMockMap({ zoom: 1, center: [0, 0] });
    render(<DebugOverlay map={map as unknown as Map} />);
    expect(screen.getByTestId(selectors.components.DebugOverlay.wrapper)).toBeInTheDocument();
  });
});
