import store from 'app/core/store';
export function saveSectionOpenState(id, isOpen) {
    store.set(`panel-edit-section-${id}`, isOpen ? 'true' : 'false');
}
export function getSectionOpenState(id, defaultValue) {
    return store.getBool(`panel-edit-section-${id}`, defaultValue);
}
//# sourceMappingURL=utils.js.map