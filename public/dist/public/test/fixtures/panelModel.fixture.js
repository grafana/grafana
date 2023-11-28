import { Chance } from 'chance';
export function wellFormedPanelModel(panelOptions, seed = 1) {
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
//# sourceMappingURL=panelModel.fixture.js.map