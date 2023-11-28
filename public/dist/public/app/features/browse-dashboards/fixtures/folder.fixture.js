import { Chance } from 'chance';
export function mockFolderDTO(seed = 1, partial) {
    const random = Chance(seed);
    const uid = random.guid();
    return Object.assign({ canAdmin: true, canDelete: true, canEdit: true, canSave: true, created: new Date(random.timestamp()).toISOString(), createdBy: '', hasAcl: true, id: 1, title: random.sentence({ words: 3 }), uid, updated: new Date(random.timestamp()).toISOString(), updatedBy: '', url: `/dashboards/f/${uid}`, version: 1 }, partial);
}
//# sourceMappingURL=folder.fixture.js.map