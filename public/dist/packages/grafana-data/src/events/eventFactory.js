var typeList = new Set();
export function eventFactory(name) {
    if (typeList.has(name)) {
        throw new Error("There is already an event defined with type '" + name + "'");
    }
    typeList.add(name);
    return { name: name };
}
//# sourceMappingURL=eventFactory.js.map