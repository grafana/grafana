import { Lexer, type Token, type Tokens } from 'marked';

import { t } from '@grafana/i18n';

import { type NotebookCellItem } from '../layout-notebook/NotebookCellItem';

export interface NotebookOutlineEntry {
  /**
   * Stable while the notebook is edited: the cell's key, plus the heading's position inside that cell.
   * Edits to other cells never change it, so they leave the outline's expanded sections alone.
   */
  id: string;
  /** The `key` of the cell the entry jumps to. Several headings in one cell all share it. */
  cellKey: string;
  kind: 'heading' | 'panel';
  label: string;
  /** Indentation, starting at 0 for the shallowest heading in the notebook. */
  depth: number;
  /** Where a heading sits inside its cell, so a jump can land on it rather than on the cell's top. */
  heading?: NotebookOutlineHeadingTarget;
}

export interface NotebookOutlineHeadingTarget {
  /** 0-based line of the heading in the cell's markdown source. */
  line: number;
  /** How many headings with the same label come before this one in the same cell. */
  occurrence: number;
}

// The options renderTextPanelMarkdown renders cells with, so the outline finds the headings a reader
// sees — including setext ones (`Title` over `===`) and ones inside quotes and lists — and none inside
// code.
const LEXER_OPTIONS = { gfm: true, pedantic: false, breaks: false };

interface RawEntry {
  cellKey: string;
  kind: 'heading' | 'panel';
  label: string;
  /** The heading's own level (1-6). Unset for a panel, whose depth comes from the heading above it. */
  level?: number;
  heading?: NotebookOutlineHeadingTarget;
  /** Position among the headings of its own cell. */
  indexInCell?: number;
}

/**
 * Flat list of what a reader would navigate by: markdown headings, nested by level, and panel cells,
 * one step under the heading they follow. Code cells and collapsed cells are left out; a collapsed
 * cell only shows its element name, which is not something a reader recognises.
 */
export function buildNotebookOutline(cells: NotebookCellItem[]): NotebookOutlineEntry[] {
  const raw: RawEntry[] = [];

  for (const cell of cells) {
    const { key, collapsed, body, content } = cell.state;
    if (!key || collapsed) {
      continue;
    }

    if (body) {
      raw.push({
        cellKey: key,
        kind: 'panel',
        label: body.state.title.trim() || t('notebook.outline.untitled-panel', 'Untitled panel'),
      });
      continue;
    }

    if (content?.kind === 'Markdown') {
      extractHeadings(content.spec.text).forEach(({ level, label, heading }, indexInCell) => {
        raw.push({ cellKey: key, kind: 'heading', label, level, heading, indexInCell });
      });
    }
  }

  // Notebooks often start at `##`, so depth is measured from the shallowest heading present rather
  // than from `#`.
  const levels = raw.flatMap((entry) => (entry.level !== undefined ? [entry.level] : []));
  const minLevel = levels.length > 0 ? Math.min(...levels) : 1;

  let headingDepth: number | undefined;
  return raw.map((entry) => {
    let depth: number;
    if (entry.level !== undefined) {
      depth = entry.level - minLevel;
      headingDepth = depth;
    } else {
      depth = headingDepth === undefined ? 0 : headingDepth + 1;
    }
    return {
      id: entry.kind === 'panel' ? `${entry.cellKey}:panel` : `${entry.cellKey}:heading-${entry.indexInCell}`,
      cellKey: entry.cellKey,
      kind: entry.kind,
      label: entry.label,
      depth,
      ...(entry.heading ? { heading: entry.heading } : {}),
    };
  });
}

export interface NotebookOutlineNode {
  entry: NotebookOutlineEntry;
  children: NotebookOutlineNode[];
}

/**
 * Nests the flat list into the tree the outline renders: each entry goes under the closest heading
 * before it that sits shallower. A level skipped in the document (`#` then `###`) still nests one step.
 */
export function nestNotebookOutline(entries: NotebookOutlineEntry[]): NotebookOutlineNode[] {
  const roots: NotebookOutlineNode[] = [];
  const headings: NotebookOutlineNode[] = [];

  for (const entry of entries) {
    const node: NotebookOutlineNode = { entry, children: [] };
    while (headings.length > 0 && headings[headings.length - 1].entry.depth >= entry.depth) {
      headings.pop();
    }
    const parent = headings[headings.length - 1];
    (parent ? parent.children : roots).push(node);
    if (entry.kind === 'heading') {
      headings.push(node);
    }
  }

  return roots;
}

interface ExtractedHeading {
  level: number;
  label: string;
  heading: NotebookOutlineHeadingTarget;
}

function extractHeadings(text: string): ExtractedHeading[] {
  const headings: ExtractedHeading[] = [];
  const seen = new Map<string, number>();

  // A quote or list item keeps every source line on a line of its own content, so counting newlines
  // through the nested tokens' `raw` still lands on the heading's line in the cell.
  const walk = (tokens: Token[], startLine: number) => {
    let line = startLine;
    for (const token of tokens) {
      if (isHeading(token)) {
        const label = inlineText(token.tokens).trim();
        if (label) {
          const occurrence = seen.get(label) ?? 0;
          seen.set(label, occurrence + 1);
          headings.push({ level: token.depth, label, heading: { line, occurrence } });
        }
      } else if (isBlockquote(token)) {
        walk(token.tokens, line);
      } else if (isList(token)) {
        let itemLine = line;
        for (const item of token.items) {
          walk(item.tokens, itemLine);
          itemLine += countNewlines(item.raw);
        }
      }
      line += countNewlines(token.raw);
    }
  };

  walk(Lexer.lex(text, LEXER_OPTIONS), 0);
  return headings;
}

/** The heading's text as rendered, without its markup: what a reader sees, and what search matches. */
function inlineText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && token.tokens) {
        return inlineText(token.tokens);
      }
      return 'text' in token && typeof token.text === 'string' ? token.text : '';
    })
    .join('');
}

// marked's Token union includes a generic `{ type: string }` member, so checking `type` alone does not
// narrow it.
function isHeading(token: Token): token is Tokens.Heading {
  return token.type === 'heading';
}

function isBlockquote(token: Token): token is Tokens.Blockquote {
  return token.type === 'blockquote';
}

function isList(token: Token): token is Tokens.List {
  return token.type === 'list';
}

function countNewlines(text: string): number {
  let count = 0;
  for (const char of text) {
    if (char === '\n') {
      count++;
    }
  }
  return count;
}
