const byRE = /\s+by\s+/im;
const groupsRE = /([\w@().]+)(?:(\s+as\s+)(\w+))?\s*,?\s*/iy;

export function getStatsGroups(query: string): string[] {
  let groups = [];

  // find " by "
  let b;
  if ((b = query.match(byRE))) {
    // continue incremental scanning from there for groups & aliases
    groupsRE.lastIndex = b.index! + b[0].length;

    let g;
    while ((g = groupsRE.exec(query))) {
      groups.push(g[2] ? g[3] : g[1]);
      groupsRE.lastIndex = g.index + g[0].length;
    }
  }

  return groups;
}
