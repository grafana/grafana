import { FAILSAFE_SCHEMA, load } from 'js-yaml';

export type YamlNode = string | null | YamlNode[] | YamlMapping;
export type YamlMapping = { [key: string]: YamlNode };

// `---` on the first line (BOM allowed) through a closing `---` or `...` line; CRLF and trailing spaces OK.
const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/**
 * Split a leading YAML front matter block off a markdown document, like GitHub does.
 * Anything that isn't a YAML mapping (invalid YAML, a list, a scalar) stays in the
 * document so it renders as before.
 */
export function splitFrontmatter(markdown: string): { frontmatter?: YamlMapping; body: string } {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    return { body: markdown };
  }

  const frontmatter = parseMapping(match[1] ?? '');
  if (!frontmatter) {
    return { body: markdown };
  }

  return { frontmatter, body: markdown.slice(match[0].length) };
}

// The failsafe schema keeps scalars as written (`1.10`, `01234`, `0x1F`, `false`) instead of
// coercing them; an explicit non-string tag like `!!int` throws and the block stays in the document.
// `json` lets a repeated key override instead of failing.
// An empty or comment-only block parses to nothing; treat it as `{}` so its fences are stripped too.
function parseMapping(yaml: string): YamlMapping | undefined {
  try {
    const parsed = load(yaml, { schema: FAILSAFE_SCHEMA, json: true }) ?? {};
    return isYamlMapping(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// Only sound because the failsafe schema yields nothing but strings, nulls, arrays and plain objects.
function isYamlMapping(value: unknown): value is YamlMapping {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
