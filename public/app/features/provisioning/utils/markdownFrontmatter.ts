import { CORE_SCHEMA, load } from 'js-yaml';

export type Frontmatter = Record<string, unknown>;

// `---` on the first line (BOM allowed) through a closing `---` or `...` line; CRLF and trailing spaces OK.
const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/**
 * Split a leading YAML front matter block off a markdown document, like GitHub does.
 * Anything that isn't a YAML mapping (invalid YAML, a list, a scalar) stays in the
 * document so it renders as before.
 */
export function splitFrontmatter(markdown: string): { frontmatter?: Frontmatter; body: string } {
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

// Core schema keeps dates as written; `json` lets a repeated key override instead of failing.
// An empty or comment-only block parses to nothing; treat it as `{}` so its fences are stripped too.
function parseMapping(yaml: string): Frontmatter | undefined {
  try {
    const parsed = load(yaml, { schema: CORE_SCHEMA, json: true }) ?? {};
    return isYamlMapping(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isYamlMapping(value: unknown): value is Frontmatter {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
