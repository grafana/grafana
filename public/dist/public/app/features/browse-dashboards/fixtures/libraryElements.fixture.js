import { Chance } from 'chance';
export function getLibraryElementsResponse(length = 1, overrides) {
    const elements = [];
    for (let i = 0; i < length; i++) {
        const random = Chance(i);
        const libraryElement = Object.assign({ type: 'timeseries', uid: random.guid(), version: 1, name: random.sentence({ words: 3 }), folderUid: random.guid(), model: {
                type: 'timeseries',
                fieldConfig: {
                    defaults: {},
                    overrides: [],
                },
                options: {},
                repeatDirection: 'h',
                transformations: [],
                transparent: false,
            } }, overrides);
        elements.push(libraryElement);
    }
    return {
        page: 1,
        perPage: 40,
        totalCount: elements.length,
        elements,
    };
}
//# sourceMappingURL=libraryElements.fixture.js.map