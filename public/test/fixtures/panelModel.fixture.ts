import { Chance } from 'chance';

import { PanelModel } from '@grafana/data';

export function wellFormedPanelModel<T extends object>(panelOptions: T, seed = 1): PanelModel<T> {
  const random = Chance(seed);

  return {
    id: random.integer(),
    type: random.word(),
    title: random.sentence({ words: 3 }),
    description: random.sentence({ words: 10 }),
    options: panelOptions,
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    pluginVersion: '9.5.0',
    targets: [],
  };
}
