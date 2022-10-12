const digArrs = (map, depth, acc = []) => {
    if (depth == 0)
        acc.push(map);
    else {
        map.forEach(v => {
            digArrs(v, depth - 1, acc);
        });
    }

    return acc;
};

// in:  [['a','b','z','b'], ['c','c','x','c']]
// out: [[0], [1,3], [2]]
export function partition(keys) {
    let len = keys[0].length;
    let klen = keys.length;

    let groups = new Map();

    for (let i = 0; i < len; i++) {
        let g = groups;

        for (let j = 0; j < klen; j++) {
            let key = keys[j][i];

            let g2 = g.get(key);

            if (g2 == null) {
                g2 = j == klen - 1 ? [] : new Map();
                g.set(key, g2);
            }

            g = g2;
        }

        g.push(i);
    }

    return digArrs(groups, klen);
}
