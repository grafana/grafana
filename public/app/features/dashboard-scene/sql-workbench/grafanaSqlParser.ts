export interface SqlCteSource {
  name: string;
  datasourceType: string;
  datasourceName: string;
  tableName: string;
  lineNumber: number;
}

export interface SqlJoinRef {
  left: string;
  right: string;
  lineNumber: number;
}

export interface GrafanaSqlStructure {
  ctes: SqlCteSource[];
  joins: SqlJoinRef[];
}

function splitCtesBalanced(block: string): string[] {
  const chunks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < block.length; i++) {
    if (block[i] === '(') {
      depth++;
    } else if (block[i] === ')') {
      depth--;
    } else if (block[i] === ',' && depth === 0) {
      chunks.push(block.slice(start, i));
      start = i + 1;
    }
  }
  chunks.push(block.slice(start));
  return chunks;
}

const CTE_NAME_RE = /^\s*(\w+)\s+AS\s*\(/i;
const SOURCE_RE = /FROM\s+`([^`]+)`\.`([^`]+)`/i;

function parseCte(chunk: string): Omit<SqlCteSource, 'lineNumber'> | null {
  const nameMatch = CTE_NAME_RE.exec(chunk);
  if (!nameMatch) {
    return null;
  }
  const cteName = nameMatch[1];

  const sourceMatch = SOURCE_RE.exec(chunk);
  if (!sourceMatch) {
    return { name: cteName, datasourceType: '', datasourceName: '', tableName: '' };
  }

  const prefix = sourceMatch[1];
  const second = sourceMatch[2];
  const colonIdx = prefix.indexOf('::');

  if (colonIdx !== -1) {
    return {
      name: cteName,
      datasourceType: prefix.slice(0, colonIdx),
      datasourceName: prefix.slice(colonIdx + 2),
      tableName: second,
    };
  }

  return {
    name: cteName,
    datasourceType: prefix,
    datasourceName: second,
    tableName: '',
  };
}

function charToLine(sql: string, idx: number): number {
  return sql.slice(0, idx).split('\n').length;
}

function findCteLineNumber(sql: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s+AS\\s*\\(`, 'i').exec(sql);
  return m ? charToLine(sql, m.index) : 1;
}

function findJoinLineNumber(sql: string, right: string): number {
  const m = new RegExp(`\\bJOIN\\s+${right}\\b`, 'i').exec(sql);
  return m ? charToLine(sql, m.index) : 1;
}

export function parseGrafanaSql(sql: string): GrafanaSqlStructure {
  const withIdx = sql.search(/\bWITH\b/i);
  if (withIdx === -1) {
    return { ctes: [], joins: [] };
  }

  // Walk from after WITH, find last ')' that drops depth to 0 — end of CTE block
  let depth = 0;
  let lastCloseIdx = -1;
  for (let i = withIdx + 4; i < sql.length; i++) {
    if (sql[i] === '(') {
      depth++;
    } else if (sql[i] === ')') {
      depth--;
      if (depth === 0) {
        lastCloseIdx = i;
      }
    }
  }

  if (lastCloseIdx === -1) {
    return { ctes: [], joins: [] };
  }

  const cteBlock = sql.slice(withIdx + 4, lastCloseIdx + 1);
  const outerSelect = sql.slice(lastCloseIdx + 1);

  const cteChunks = splitCtesBalanced(cteBlock);
  const rawCtes = cteChunks.map(parseCte).filter((c): c is Omit<SqlCteSource, 'lineNumber'> => c !== null);
  const ctes: SqlCteSource[] = rawCtes.map((c) => ({
    ...c,
    lineNumber: findCteLineNumber(sql, c.name),
  }));

  const cteNames = new Set(ctes.map((c) => c.name));
  const joins: SqlJoinRef[] = [];
  const joinPairRe = /\bFROM\s+(\w+)\s+JOIN\s+(\w+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = joinPairRe.exec(outerSelect)) !== null) {
    if (cteNames.has(m[1]) && cteNames.has(m[2])) {
      joins.push({
        left: m[1],
        right: m[2],
        lineNumber: findJoinLineNumber(sql, m[2]),
      });
    }
  }

  return { ctes, joins };
}
