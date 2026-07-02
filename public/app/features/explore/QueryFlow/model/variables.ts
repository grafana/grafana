import { variableRegex } from 'app/features/variables/utils';

import { type SourceSpan } from './types';

interface VarSegment {
  origFrom: number;
  origTo: number;
  repFrom: number;
  repTo: number;
}

export interface VarSpanMap {
  segments: VarSegment[];
}

export interface ReplacedExpr {
  replaced: string;
  map: VarSpanMap;
}

/**
 * Replace template variables with parsable placeholder tokens (Lezer cannot parse a raw `$var`),
 * recording each replacement's offsets so spans in the parsed tree can be mapped back to the
 * original text. Mapping back is what lets a future editor splice the original query precisely.
 */
export function replaceVariables(expr: string): ReplacedExpr {
  const segments: VarSegment[] = [];
  let replaced = '';
  let lastIndex = 0;
  variableRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = variableRegex.exec(expr)) !== null) {
    const [whole, var1, var2, fmt2, var3, , fmt3] = match;
    replaced += expr.slice(lastIndex, match.index);

    const repFrom = replaced.length;
    const fmt = fmt2 || fmt3;
    let variable = var1;
    let varType = '0';
    if (var2) {
      variable = var2;
      varType = '1';
    }
    if (var3) {
      variable = var3;
      varType = '2';
    }
    replaced += `__V_${varType}__${variable}__V__${fmt ? `__F__${fmt}__F__` : ''}`;

    segments.push({ origFrom: match.index, origTo: match.index + whole.length, repFrom, repTo: replaced.length });
    lastIndex = match.index + whole.length;
  }
  replaced += expr.slice(lastIndex);

  return { replaced, map: { segments } };
}

/** Map a span in the variable-replaced string back to original-text coordinates. */
export function mapSpanToOriginal(span: SourceSpan, map: VarSpanMap): SourceSpan {
  return { from: mapPos(span.from, map, false), to: mapPos(span.to, map, true) };
}

function mapPos(pos: number, map: VarSpanMap, isEnd: boolean): number {
  let shift = 0;
  for (const seg of map.segments) {
    if (pos >= seg.repTo) {
      shift += seg.origTo - seg.origFrom - (seg.repTo - seg.repFrom);
    } else if (pos > seg.repFrom) {
      // Inside a replacement: clamp to the original variable's bounds.
      return isEnd ? seg.origTo : seg.origFrom;
    } else {
      break;
    }
  }
  return pos + shift;
}
