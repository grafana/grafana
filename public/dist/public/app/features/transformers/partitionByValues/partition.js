/** The totally type-aware flavor is much slower, so we prefer to disable the lint rule in this case */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
const digArrs = (map, depth, acc = []) => {
    // the leaf nodes are always Idxs
    if (depth === 0) {
        acc.push(map);
    }
    // the branch nodes are always KeyMaps
    else {
        map.forEach((v) => {
            digArrs(v, depth - 1, acc);
        });
    }
    return acc;
};
// in:  [['a','b','z','b'], ['c','c','x','c']]
// out: [[0], [1,3], [2]]
export function partition(keys) {
    const len = keys[0].length;
    const klen = keys.length;
    const rootMap = new Map();
    for (let i = 0; i < len; i++) {
        let cur = rootMap;
        for (let j = 0; j < klen; j++) {
            let key = keys[j][i];
            let next = cur.get(key);
            if (next == null) {
                next = j === klen - 1 ? [] : new Map();
                cur.set(key, next);
            }
            cur = next;
        }
        cur.push(i);
    }
    return digArrs(rootMap, klen);
}
/* eslint-enable @typescript-eslint/consistent-type-assertions */
//# sourceMappingURL=partition.js.map