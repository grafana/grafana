/**
 * CLI helper: deterministic accept/discard of variant sessions.
 *
 * Usage:
 *   node live-accept.mjs --id SESSION_ID --discard
 *   node live-accept.mjs --id SESSION_ID --variant N
 *
 * For discard: removes the entire variant wrapper and restores the original.
 * For accept: replaces the wrapper with the chosen variant's content. If the
 * session had a colocated <style> block, it's preserved with carbonize markers
 * for a background agent to integrate into the project's CSS.
 *
 * Output: JSON to stdout.
 */

import fs from 'node:fs';
import path from 'node:path';
import { isGeneratedFile } from './is-generated.mjs';

const EXTENSIONS = ['.html', '.jsx', '.tsx', '.vue', '.svelte', '.astro'];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export async function acceptCli() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node live-accept.mjs [options]

Deterministic accept/discard for live variant sessions.

Modes:
  --discard          Remove variants, restore original
  --variant N        Accept variant N, discard the rest

Required:
  --id SESSION_ID    Session ID of the variant wrapper

Output (JSON):
  { handled, file, carbonize }`);
    process.exit(0);
  }

  const id = argVal(args, '--id');
  const variantNum = argVal(args, '--variant');
  const paramValuesRaw = argVal(args, '--param-values');
  const isDiscard = args.includes('--discard');

  if (!id) { console.error('Missing --id'); process.exit(1); }
  if (!isDiscard && !variantNum) { console.error('Need --discard or --variant N'); process.exit(1); }

  let paramValues = null;
  if (paramValuesRaw) {
    try { paramValues = JSON.parse(paramValuesRaw); }
    catch { paramValues = null; } // malformed blob: skip the comment rather than failing the accept
  }

  // Find the file containing this session's markers
  const found = findSessionFile(id, process.cwd());
  if (!found) {
    console.log(JSON.stringify({ handled: false, error: 'Session markers not found for id: ' + id }));
    process.exit(0);
  }

  const { file: targetFile, content, lines } = found;
  const relFile = path.relative(process.cwd(), targetFile);

  // Bail if the session lives in a generated file. The agent manually wrote
  // the wrapper there for preview, and is responsible for writing the
  // accepted variant to true source (or cleaning up on discard). See
  // "Handle fallback" in live.md.
  if (isGeneratedFile(targetFile, { cwd: process.cwd() })) {
    console.log(JSON.stringify({
      handled: false,
      mode: 'fallback',
      file: relFile,
      hint: 'Session is in a generated file. Persist the accepted variant in source; do not rely on this script.',
    }));
    process.exit(0);
  }

  if (isDiscard) {
    const result = handleDiscard(id, lines, targetFile);
    console.log(JSON.stringify({ handled: true, file: relFile, carbonize: false, ...result }));
  } else {
    const result = handleAccept(id, variantNum, lines, targetFile, paramValues);
    // Single-line attention-grabber when cleanup is required. The full
    // five-step checklist lives in reference/live.md (loaded once per
    // session); repeating it per-event would waste tokens.
    if (result.carbonize) {
      result.todo = 'REQUIRED before next poll: carbonize cleanup in ' + relFile + '. See reference/live.md "Required after accept".';
    }
    console.log(JSON.stringify({ handled: true, file: relFile, ...result }));
  }
}

// ---------------------------------------------------------------------------
// Discard
// ---------------------------------------------------------------------------

function handleDiscard(id, lines, targetFile) {
  const block = findMarkerBlock(id, lines);
  if (!block) return { handled: false, error: 'Markers not found' };

  const original = extractOriginal(lines, block);
  const isJsx = detectCommentSyntax(targetFile).open === '{/*';
  const replaceRange = expandReplaceRange(block, lines, isJsx);

  // Restore at the line we're actually replacing FROM, not the marker line.
  // For JSX wrappers the marker comments live INSIDE the outer `<div>`, so
  // `block.start` sits 2 spaces deeper than the original element. Using that
  // as the deindent base would push the restored content 2 spaces too far
  // right on every JSX/TSX session. `replaceRange.start` is the outer wrapper
  // line, which is at the original element's indent for both HTML and JSX.
  const indent = lines[replaceRange.start].match(/^(\s*)/)[1];
  const restored = deindentContent(original, indent);

  const newLines = [
    ...lines.slice(0, replaceRange.start),
    ...restored,
    ...lines.slice(replaceRange.end + 1),
  ];
  fs.writeFileSync(targetFile, newLines.join('\n'), 'utf-8');
  return {};
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------

function handleAccept(id, variantNum, lines, targetFile, paramValues) {
  const block = findMarkerBlock(id, lines);
  if (!block) return { handled: false, error: 'Markers not found' };

  const commentSyntax = detectCommentSyntax(targetFile);
  const isJsx = commentSyntax.open === '{/*';
  // Anchor indent on the line we're replacing FROM (the outer wrapper),
  // not on `block.start` — for JSX that's the marker comment 2 spaces
  // deeper than the original element. See handleDiscard for the full
  // rationale.
  const replaceRange = expandReplaceRange(block, lines, isJsx);
  const indent = lines[replaceRange.start].match(/^(\s*)/)[1];

  // Extract the chosen variant's inner content
  const variantContent = extractVariant(lines, block, variantNum);
  if (!variantContent) return { handled: false, error: 'Variant ' + variantNum + ' not found' };

  // Extract CSS block if present
  const cssContent = extractCss(lines, block, id);

  // Check if carbonizing is needed:
  // - CSS block exists, OR
  // - variant HTML contains helper classes/attributes that need cleanup
  const variantText = variantContent.join('\n');
  const hasHelperAttrs = variantText.includes('data-impeccable-variant');
  const needsCarbonize = !!(cssContent || hasHelperAttrs);

  // Build the replacement
  const restored = deindentContent(variantContent, indent);
  const replacement = [];

  if (cssContent) {
    replacement.push(indent + commentSyntax.open + ' impeccable-carbonize-start ' + id + ' ' + commentSyntax.close);
    // JSX targets need the CSS body wrapped in a template literal so that the
    // `{` and `}` in CSS rules don't get parsed as JSX expressions.
    replacement.push(indent + '<style data-impeccable-css="' + id + '">' + (isJsx ? '{`' : ''));
    // Re-indent CSS content to match
    for (const cssLine of cssContent) {
      replacement.push(indent + cssLine.trimStart());
    }
    replacement.push(indent + (isJsx ? '`}</style>' : '</style>'));
    if (paramValues && Object.keys(paramValues).length > 0) {
      // Preserve the user's knob positions for the carbonize-cleanup agent
      // to bake into the final CSS when it collapses scoped rules.
      replacement.push(indent + commentSyntax.open + ' impeccable-param-values ' + id + ': ' + JSON.stringify(paramValues) + ' ' + commentSyntax.close);
    }
    replacement.push(indent + commentSyntax.open + ' impeccable-carbonize-end ' + id + ' ' + commentSyntax.close);
  }

  // Keep the `@scope ([data-impeccable-variant="N"])` selectors in the
  // carbonize CSS block working visually by re-wrapping the accepted content
  // in a data-impeccable-variant="N" div with `display: contents` (so layout
  // isn't affected). The carbonize agent strips this attribute + wrapper when
  // it moves the CSS to a proper stylesheet.
  //
  // Style attribute syntax has to follow the host file's flavor — JSX files
  // need the object form, otherwise React 19 throws "Failed to set indexed
  // property [0] on CSSStyleDeclaration" while parsing the string char-by-char.
  if (cssContent) {
    const styleAttr = isJsx ? "style={{ display: 'contents' }}" : 'style="display: contents"';
    replacement.push(indent + '<div data-impeccable-variant="' + variantNum + '" ' + styleAttr + '>');
    replacement.push(...restored);
    replacement.push(indent + '</div>');
  } else {
    replacement.push(...restored);
  }

  const newLines = [
    ...lines.slice(0, replaceRange.start),
    ...replacement,
    ...lines.slice(replaceRange.end + 1),
  ];
  fs.writeFileSync(targetFile, newLines.join('\n'), 'utf-8');

  return { carbonize: needsCarbonize };
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Find the start/end marker lines for a session.
 * Returns { start, end } (0-indexed line numbers) or null.
 */
function findMarkerBlock(id, lines) {
  let start = -1;
  let end = -1;
  const startPattern = 'impeccable-variants-start ' + id;
  const endPattern = 'impeccable-variants-end ' + id;

  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && lines[i].includes(startPattern)) start = i;
    if (lines[i].includes(endPattern)) { end = i; break; }
  }

  return (start !== -1 && end !== -1) ? { start, end } : null;
}

/**
 * Compute the line range to REPLACE (vs. just the marker range to extract
 * from). For JSX/TSX wrappers, live-wrap places the marker comments INSIDE
 * the `<div data-impeccable-variants="ID">` outer wrapper so the picked
 * element's JSX slot keeps a single child — a Fragment `<></>` would have
 * solved the multi-sibling case but failed inside `asChild` / cloneElement
 * parents with "Invalid prop supplied to React.Fragment".
 *
 * That means the marker block is enclosed by the wrapper `<div>` opener
 * (with `data-impeccable-variants="ID"`) and its matching `</div>`. We
 * walk back to the opener and forward to the closer so accept/discard
 * remove the entire scaffold, not just the inner markers.
 *
 * Marker lines themselves stay where they were so extractOriginal /
 * extractVariant / extractCss continue to walk the same range.
 */
function expandReplaceRange(block, lines, isJsx) {
  if (!isJsx) return { start: block.start, end: block.end };

  let { start, end } = block;

  // Walk back for the wrapper `<div data-impeccable-variants="..."` opener.
  // The attr may sit on a continuation line of a multi-line opening tag, so
  // also walk to the line that actually contains `<div`.
  for (let i = start - 1; i >= Math.max(0, start - 12); i--) {
    if (/data-impeccable-variants=/.test(lines[i])) {
      let opener = i;
      while (opener > 0 && !/<div\b/.test(lines[opener])) opener--;
      start = opener;
      break;
    }
  }

  // Walk forward to the matching `</div>` by div-depth tracking from the
  // wrapper opener. Operate on JOINED text instead of per-line: a
  // multi-line self-closing JSX `<div\n  className="spacer"\n/>` would
  // fool per-line regex tracking (the `<div` line matches openRe but the
  // `/>` line never matches selfCloseRe since it needs `<div` on the same
  // line). That left depth permanently over-counted and the wrapper's
  // outer `</div>` orphaned after accept/discard. Single regex with
  // `[^>]*?` (which spans newlines in JS) handles either form correctly.
  const joined = lines.slice(start).join('\n');
  // Match either `<div … />` (self-close, group 1 is `/`), `<div … >`
  // (open, group 1 is empty), or `</div>`.
  const tagRe = /<div\b[^>]*?(\/?)>|<\/div\s*>/g;
  let depth = 0;
  let m;
  while ((m = tagRe.exec(joined)) !== null) {
    const isClose = m[0].startsWith('</');
    const isSelfClose = !isClose && m[1] === '/';
    if (isClose) depth--;
    else if (!isSelfClose) depth++;
    if (depth <= 0) {
      // m.index is offset within `joined`; convert back to a file line.
      const linesBefore = joined.slice(0, m.index + m[0].length).split('\n').length - 1;
      const candidateEnd = start + linesBefore;
      if (candidateEnd >= end) {
        end = candidateEnd;
        break;
      }
    }
  }

  return { start, end };
}

/**
 * Join wrapper lines into a single string with `<style>` elements removed so
 * marker matching and div-depth tracking aren't confused by:
 *   - CSS `@scope ([data-impeccable-variant="N"])` strings that look like the
 *     HTML marker we're searching for
 *   - JSX self-closing `<style ... />` (no separate `</style>` to close on)
 *   - Same-line `<style>…</style>` blocks
 *   - Multi-line `<style>\n…\n</style>` blocks
 */
function stripStyleAndJoin(lines, block) {
  const out = [];
  let inStyle = false;
  for (let i = block.start; i <= block.end; i++) {
    let line = lines[i];

    if (!inStyle) {
      // Strip any complete <style> elements on this line (self-closed or
      // same-line-closed), including their body content.
      line = line
        .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/g, '')
        .replace(/<style\b[^>]*\/\s*>/g, '');

      // If a <style> opener remains (multi-line body starts here), strip from
      // the opener to end-of-line and flip into skip mode.
      const openerIdx = line.search(/<style\b/);
      if (openerIdx !== -1) {
        line = line.slice(0, openerIdx);
        inStyle = true;
      }
      out.push(line);
    } else {
      // In multi-line style body; drop everything until we see </style>.
      const closeIdx = line.search(/<\/style\s*>/);
      if (closeIdx !== -1) {
        inStyle = false;
        out.push(line.slice(closeIdx).replace(/<\/style\s*>/, ''));
      }
      // else: skip line entirely
    }
  }
  return out.join('\n');
}

/**
 * Find the inner content of `<TAG ...attrMatch...>…</TAG>` inside `text`,
 * handling nested same-tag elements via depth counting. `attrMatch` is a
 * regex source fragment that must appear inside the opener tag.
 * Returns the inner string (may be empty), or null if not found.
 */
function extractInnerByAttr(text, attrMatch) {
  const openerRe = new RegExp('<([A-Za-z][A-Za-z0-9]*)\\b[^>]*' + attrMatch + '[^>]*>');
  const openMatch = text.match(openerRe);
  if (!openMatch) return null;

  const tagName = openMatch[1];
  const innerStart = openMatch.index + openMatch[0].length;

  // Match any opener or closer of this tag name after innerStart.
  // (Does not match self-closing <TAG … />, which doesn't contribute to depth.)
  const tagRe = new RegExp('<(?:/)?' + tagName + '\\b[^>]*>', 'g');
  tagRe.lastIndex = innerStart;

  let depth = 1;
  let m;
  while ((m = tagRe.exec(text))) {
    const isClose = m[0].startsWith('</');
    const isSelfClose = !isClose && /\/\s*>$/.test(m[0]);
    if (isClose) {
      depth--;
      if (depth === 0) return text.slice(innerStart, m.index);
    } else if (!isSelfClose) {
      depth++;
    }
  }
  return null;
}

/**
 * Extract the original element content from within the variant wrapper.
 * Returns an array of lines.
 */
function extractOriginal(lines, block) {
  const text = stripStyleAndJoin(lines, block);
  const inner = extractInnerByAttr(text, 'data-impeccable-variant="original"');
  if (inner === null) return [];
  return inner.split('\n');
}

/**
 * Extract a specific variant's inner content (stripping the wrapper div).
 * Returns an array of lines, or null if not found.
 */
function extractVariant(lines, block, variantNum) {
  const text = stripStyleAndJoin(lines, block);
  const inner = extractInnerByAttr(text, 'data-impeccable-variant="' + variantNum + '"');
  if (inner === null) return null;
  const result = inner.split('\n');
  // Collapse a lone empty leading/trailing line (common after string splice).
  while (result.length > 1 && result[0].trim() === '') result.shift();
  while (result.length > 1 && result[result.length - 1].trim() === '') result.pop();
  return result.length > 0 ? result : null;
}

/**
 * Extract the colocated <style> block content (between the style tags).
 * Returns an array of CSS lines, or null if no style block found.
 *
 * Handles three shapes of `<style data-impeccable-css="ID" ...>`:
 *   1. Self-closing: `<style ... />` — no body; return null (nothing to carbonize).
 *   2. Same-line open+close: `<style>...</style>` — return the inner content.
 *   3. Multi-line: `<style>` on one line, `</style>` on a later line — return
 *      the lines between them.
 */
function extractCss(lines, block, id) {
  const styleAttr = 'data-impeccable-css="' + id + '"';
  let inStyle = false;
  const content = [];

  for (let i = block.start; i <= block.end; i++) {
    const line = lines[i];

    if (!inStyle && line.includes(styleAttr)) {
      // Self-closing: nothing to carbonize.
      if (/<style\b[^>]*\/\s*>/.test(line)) return null;
      // Same-line open + close: extract inner text.
      const sameLine = line.match(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/);
      if (sameLine) {
        const inner = stripJsxTemplateWrap(sameLine[1]);
        return inner.length > 0 ? inner.split('\n') : null;
      }
      inStyle = true;
      continue; // skip the <style> opening tag
    }

    if (inStyle) {
      // Detect </style> anywhere on the line — JSX template-literal closes
      // (`}</style>`) put the close mid-line, and we don't want to absorb the
      // template-literal punctuation as CSS content.
      const closeIdx = line.indexOf('</style>');
      if (closeIdx !== -1) break;
      content.push(line);
    }
  }

  if (content.length === 0) return null;
  return stripJsxTemplateLines(content);
}

/**
 * Strip a JSX template-literal wrap (`{` … `}`) from CSS extracted out of a
 * `<style>` element in a JSX/TSX file. The agent may write the wrap with
 * `{` and `}` directly attached to the `<style>` tags, on their own lines,
 * or attached to the first/last CSS lines — all three are JSX-legal.
 *
 * Stripping is required because handleAccept re-wraps the CSS itself when
 * carbonizing. Without this, two consecutive accepts (or a previously-
 * accepted variants block being carbonized) would produce nested
 * `{` `{` … `}` `}`, which oxc rejects with "Expected `}` but found `@`".
 */
function stripJsxTemplateLines(content) {
  const out = content.slice();

  // Drop any leading blank lines so we don't miss a `{` line buried below
  // them; same for trailing.
  while (out.length > 0 && out[0].trim() === '') out.shift();
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  if (out.length === 0) return null;

  // Leading `{`: own line, or attached to the first CSS line.
  const firstTrim = out[0].trimStart();
  if (firstTrim === '{`') {
    out.shift();
  } else if (firstTrim.startsWith('{`')) {
    const idx = out[0].indexOf('{`');
    out[0] = out[0].slice(0, idx) + out[0].slice(idx + 2);
    if (out[0].trim() === '') out.shift();
  }
  if (out.length === 0) return null;

  // Trailing `` ` `` `}`: own line, or attached to the last CSS line.
  const lastIdx = out.length - 1;
  const lastTrim = out[lastIdx].trimEnd();
  if (lastTrim === '`}') {
    out.pop();
  } else if (lastTrim.endsWith('`}')) {
    const text = out[lastIdx];
    const idx = text.lastIndexOf('`}');
    out[lastIdx] = text.slice(0, idx) + text.slice(idx + 2);
    if (out[lastIdx].trim() === '') out.pop();
  }

  return out.length > 0 ? out : null;
}

function stripJsxTemplateWrap(text) {
  const lines = text.split('\n');
  const stripped = stripJsxTemplateLines(lines);
  return stripped ? stripped.join('\n') : '';
}

/**
 * De-indent content that was indented by live-wrap.mjs.
 * The wrap script adds `indent + '    '` (4 extra spaces) to each line.
 * We restore to just `indent` level.
 */
function deindentContent(contentLines, baseIndent) {
  // Find the minimum indentation in the content to determine how much was added
  let minIndent = Infinity;
  for (const line of contentLines) {
    if (line.trim() === '') continue;
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    minIndent = Math.min(minIndent, leadingSpaces);
  }
  if (minIndent === Infinity) minIndent = 0;

  // Strip the extra indentation and re-add base indent
  return contentLines.map(line => {
    if (line.trim() === '') return '';
    return baseIndent + line.slice(minIndent);
  });
}

function detectCommentSyntax(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jsx' || ext === '.tsx') {
    return { open: '{/*', close: '*/}' };
  }
  return { open: '<!--', close: '-->' };
}

// ---------------------------------------------------------------------------
// File search (find the file containing session markers)
// ---------------------------------------------------------------------------

function findSessionFile(id, cwd) {
  const marker = 'impeccable-variants-start ' + id;
  const searchDirs = ['src', 'app', 'pages', 'components', 'public', 'views', 'templates', '.'];
  const seen = new Set();

  for (const dir of searchDirs) {
    const absDir = path.join(cwd, dir);
    if (!fs.existsSync(absDir)) continue;
    const result = searchDir(absDir, marker, seen, 0);
    if (result) {
      const content = fs.readFileSync(result, 'utf-8');
      return { file: result, content, lines: content.split('\n') };
    }
  }
  return null;
}

function searchDir(dir, query, seen, depth) {
  if (depth > 5) return null;
  let realDir;
  try { realDir = fs.realpathSync(dir); } catch { return null; }
  if (seen.has(realDir)) return null;
  seen.add(realDir);

  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return null; }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(query)) return filePath;
    } catch { /* skip */ }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
    const result = searchDir(path.join(dir, entry.name), query, seen, depth + 1);
    if (result) return result;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function argVal(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

// Auto-execute when run directly
const _running = process.argv[1];
if (_running?.endsWith('live-accept.mjs') || _running?.endsWith('live-accept.mjs/')) {
  acceptCli();
}

export { findMarkerBlock, extractOriginal, extractVariant, extractCss, deindentContent, detectCommentSyntax };
