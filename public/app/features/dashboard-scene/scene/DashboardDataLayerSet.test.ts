import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';

it('preserves retained layer subscriptions and deactivates removed layers', () => {
  const first = new DashboardAnnotationsDataLayer({
    name: 'First',
    isEnabled: false,
    query: { name: 'First', enable: false, iconColor: 'red' },
  });
  const second = new DashboardAnnotationsDataLayer({
    name: 'Second',
    isEnabled: false,
    query: { name: 'Second', enable: false, iconColor: 'blue' },
  });
  const layers = new DashboardDataLayerSet({ annotationLayers: [first] });
  const deactivate = layers.activate();
  const onFirstStateChange = jest.fn();
  const subscription = first.subscribeToState(onFirstStateChange);

  try {
    layers.setState({ annotationLayers: [first, second] });
    first.setState({ name: 'Updated' });
    expect(onFirstStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Updated' }),
      expect.objectContaining({ name: 'First' })
    );
    expect(second.isActive).toBe(true);

    layers.setState({ annotationLayers: [first] });
    expect(second.isActive).toBe(false);
    first.setState({ name: 'Still subscribed' });
    expect(onFirstStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Still subscribed' }),
      expect.objectContaining({ name: 'Updated' })
    );

    layers.setState({ annotationLayers: [] });
    expect(first.isActive).toBe(false);
    expect(layers.state.data?.series).toEqual([]);
  } finally {
    subscription.unsubscribe();
    deactivate();
  }
});
