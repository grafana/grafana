var byRE = /\s+by\s+/im;
/**
 * groups look like this: (@a.foo)( as )(bar),
 * group 1 is the field, group 2 is " as " and group 3 is the alias
 * this regex will not advance past any non-identifier or whitespace characters, e.g. |
 */
var groupsRE = /([\w$@().]+)(?:(\s+as\s+)([\w$]+))?\s*,?\s*/iy;
export function getStatsGroups(query) {
    var groups = [];
    // find " by "
    var b;
    if ((b = query.match(byRE))) {
        // continue incremental scanning from there for groups & aliases
        groupsRE.lastIndex = b.index + b[0].length;
        var g = void 0;
        while ((g = groupsRE.exec(query))) {
            groups.push(g[2] ? g[3] : g[1]);
            groupsRE.lastIndex = g.index + g[0].length;
        }
    }
    return groups;
}
//# sourceMappingURL=getStatsGroups.js.map