import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type GeomapLayerHover } from 'app/plugins/panel/geomap/event';
import { type MapLayerState } from 'app/plugins/panel/geomap/types';

import { DataHoverTabs } from './DataHoverTabs';

function makeLayer(name: string, featureCount: number): GeomapLayerHover {
  return {
    layer: { getName: () => name } as MapLayerState,
    features: Array.from({ length: featureCount }, (_, i) => ({
      getId: () => i,
      getGeometry: () => undefined,
      getProperties: () => ({}),
      get: () => undefined,
    })) as unknown as GeomapLayerHover['features'],
  };
}

describe('DataHoverTabs', () => {
  it('renders a tab for each layer', () => {
    const layers = [makeLayer('Roads', 1), makeLayer('Buildings', 1)];
    render(<DataHoverTabs layers={layers} activeTabIndex={0} setActiveTabIndex={jest.fn()} />);
    expect(screen.getByRole('tab', { name: /roads/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /buildings/i })).toBeInTheDocument();
  });

  it('marks the tab at activeTabIndex as active', () => {
    const layers = [makeLayer('Alpha', 1), makeLayer('Beta', 1)];
    render(<DataHoverTabs layers={layers} activeTabIndex={1} setActiveTabIndex={jest.fn()} />);
    expect(screen.getByRole('tab', { name: /beta/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /alpha/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows feature count as counter when a layer has more than one feature', () => {
    const layers = [makeLayer('Pins', 3)];
    render(<DataHoverTabs layers={layers} activeTabIndex={0} setActiveTabIndex={jest.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show a counter when a layer has exactly one feature', () => {
    const layers = [makeLayer('Single', 1)];
    render(<DataHoverTabs layers={layers} activeTabIndex={0} setActiveTabIndex={jest.fn()} />);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('calls setActiveTabIndex with the clicked tab index', async () => {
    const setActiveTabIndex = jest.fn();
    const layers = [makeLayer('First', 1), makeLayer('Second', 1)];
    render(<DataHoverTabs layers={layers} activeTabIndex={0} setActiveTabIndex={setActiveTabIndex} />);
    await userEvent.click(screen.getByRole('tab', { name: /second/i }));
    expect(setActiveTabIndex).toHaveBeenCalledWith(1);
  });

  it('renders nothing when layers is undefined', () => {
    render(<DataHoverTabs layers={undefined} activeTabIndex={0} setActiveTabIndex={jest.fn()} />);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
