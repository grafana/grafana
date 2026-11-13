import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';

import { partitionAnnotationsByDisplay } from './partitionAnnotations';

function layer(name: string, state: Partial<DashboardAnnotationsDataLayer['state']> = {}) {
  return new DashboardAnnotationsDataLayer({ name, query: { name, enable: true, iconColor: 'red' }, ...state });
}

const names = (layers: DashboardAnnotationsDataLayer[]) => layers.map((l) => l.state.name);

describe('partitionAnnotationsByDisplay', () => {
  const layers = [
    layer('first'),
    layer('menu', { placement: 'inControlsMenu' }),
    layer('hidden', { isHidden: true }),
    layer('last'),
  ];

  it('groups layers by where their controls are shown', () => {
    const { visible, controlsMenu, hidden } = partitionAnnotationsByDisplay(layers);

    expect(names(visible)).toEqual(['first', 'last']);
    expect(names(controlsMenu)).toEqual(['menu']);
    expect(names(hidden)).toEqual(['hidden']);
  });

  it('lists layers placed in the controls menu as visible, in order, when there is no controls menu', () => {
    const { visible, controlsMenu, hidden } = partitionAnnotationsByDisplay(layers, { hasControlsMenu: false });

    expect(names(visible)).toEqual(['first', 'menu', 'last']);
    expect(controlsMenu).toEqual([]);
    expect(names(hidden)).toEqual(['hidden']);
  });
});
