import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type Map from 'ol/Map';

import { selectors } from '@grafana/e2e-selectors';

import { createMockMap } from '../__fixtures__/olMapMock';

import { MeasureOverlay } from './MeasureOverlay';

// MeasureOverlay uses `useRef(new MeasureVectorLayer())`, which re-evaluates `new` on every
// render but only keeps the first instance in the ref. A singleton mock keeps assertions stable
// no matter how many times React re-renders.
const sharedVector = {
  setOptions: jest.fn(),
  setVisible: jest.fn(),
  setZIndex: jest.fn(),
  addInteraction: jest.fn(),
  draw: { kind: 'draw' },
  modify: { kind: 'modify' },
};

jest.mock('./MeasureVectorLayer', () => ({
  MeasureVectorLayer: jest.fn().mockImplementation(() => sharedVector),
}));

describe('MeasureOverlay', () => {
  beforeEach(() => {
    sharedVector.setOptions.mockClear();
    sharedVector.setVisible.mockClear();
    sharedVector.setZIndex.mockClear();
    sharedVector.addInteraction.mockClear();
  });

  it('should render the closed measure button by default', () => {
    const { map } = createMockMap();
    render(<MeasureOverlay map={map as unknown as Map} menuActiveState={jest.fn()} />);

    expect(screen.getByTestId(selectors.components.PanelEditor.measureButton)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('should open the menu and initialize the vector layer on first click', async () => {
    const user = userEvent.setup();
    const { map } = createMockMap();
    const menuActiveState = jest.fn();
    render(<MeasureOverlay map={map as unknown as Map} menuActiveState={menuActiveState} />);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.measureButton));

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(menuActiveState).toHaveBeenCalledWith(true);

    const vector = sharedVector;
    expect(vector.setZIndex).toHaveBeenCalledWith(1);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.addInteraction).toHaveBeenCalledWith(vector.modify);
    expect(vector.setVisible).toHaveBeenCalledWith(true);
    // The default measurement is the first entry of `measures`, which has geometry 'LineString'.
    expect(vector.addInteraction).toHaveBeenCalledWith(map, 'LineString', false, true);
  });

  it('should not re-add the vector layer on subsequent open/close cycles', async () => {
    const user = userEvent.setup();
    const { map } = createMockMap();
    render(<MeasureOverlay map={map as unknown as Map} menuActiveState={jest.fn()} />);

    // open
    await user.click(screen.getByTestId(selectors.components.PanelEditor.measureButton));
    // close
    await user.click(screen.getByRole('button', { name: /close measure tools/i }));
    // open again
    await user.click(screen.getByTestId(selectors.components.PanelEditor.measureButton));

    expect(map.addLayer).toHaveBeenCalledTimes(1);
  });

  it('should hide the vector layer and remove the draw interaction when closing the menu', async () => {
    const user = userEvent.setup();
    const { map } = createMockMap();
    const menuActiveState = jest.fn();
    render(<MeasureOverlay map={map as unknown as Map} menuActiveState={menuActiveState} />);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.measureButton));
    const vector = sharedVector;
    const drawAtOpen = vector.draw;

    await user.click(screen.getByRole('button', { name: /close measure tools/i }));

    expect(menuActiveState).toHaveBeenLastCalledWith(false);
    expect(map.removeInteraction).toHaveBeenCalledWith(drawAtOpen);
    expect(vector.setVisible).toHaveBeenLastCalledWith(false);
    // Menu should be collapsed again.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.PanelEditor.measureButton)).toBeInTheDocument();
  });

  it('should switch the geometry passed to addInteraction when the user picks Area', async () => {
    const user = userEvent.setup();
    const { map } = createMockMap();
    render(<MeasureOverlay map={map as unknown as Map} menuActiveState={jest.fn()} />);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.measureButton));
    const vector = sharedVector;
    vector.addInteraction.mockClear();

    await user.click(screen.getByRole('radio', { name: /area/i }));

    expect(vector.addInteraction).toHaveBeenCalledWith(map, 'Polygon', false, true);
  });

  it('should update the vector options when the unit Select changes', async () => {
    const user = userEvent.setup();
    const { map } = createMockMap();
    render(<MeasureOverlay map={map as unknown as Map} menuActiveState={jest.fn()} />);

    await user.click(screen.getByTestId(selectors.components.PanelEditor.measureButton));
    const vector = sharedVector;
    // Opening the menu re-renders, which fires the useMemo and calls setOptions with the default unit ('m').
    expect(vector.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'length', unit: 'm' }));
    vector.setOptions.mockClear();

    // Open the unit Select. Its current value reads "Metric (m/km)"; click it to open the menu.
    await user.click(screen.getByText('Metric (m/km)'));
    // Pick a different unit from the same length category.
    await user.click(screen.getByText('Miles (mi)'));

    expect(vector.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'length', unit: 'mi' }));
  });
});
