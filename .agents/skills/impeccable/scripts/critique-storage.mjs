#!/usr/bin/env node
/**
 * Critique persistence helper.
 *
 * Each run of /impeccable critique writes a per-target snapshot to
 *   .impeccable/critique/<timestamp>__<slug>.md
 * with a small YAML frontmatter carrying the score + P0/P1 counts.
 *
 * /impeccable polish reads the latest matching snapshot at start as its
 * fix backlog. No other skill auto-reads critique output.
 *
 * The slug is derived mechanically from the *resolved* primary artifact
 * (file path or URL), never from the user's natural-language phrasing.
 * Slug stability across runs is what lets the trend display work.
 *
 * CLI entry points (called from skill instructions):
 *   node critique-storage.mjs slug <resolved-target>
 *   node critique-storage.mjs write <slug> <snapshot-body-file>
 *   node critique-storage.mjs latest <slug>
 *   node critique-storage.mjs trend <slug> [limit]
 *
 * Note: there is intentionally no `ignore` subcommand. ignore.md is a plain
 * markdown file; the model reads it directly with its file-read tool. This
 * helper only exists for operations the model can't trivially do inline
 * (normalizing paths, generating filenames, globbing + parsing frontmatter).
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getCritiqueDir } from './impeccable-paths.mjs';

const SLUG_MAX = 50;

/**
 * Mechanically derive a slug from a resolved target. Returns null if the
 * input doesn't look like a stable identifier (empty, project root, etc).
 *
 * Accepts file paths and URLs. The model resolves "the homepage" to a
 * concrete artifact before calling this — we never slug a natural-language
 * phrase.
 */
export function slugFromTarget(resolved, { cwd = process.cwd() } = {}) {
  if (!resolved || typeof resolved !== 'string') return null;
  const trimmed = resolved.trim();
  if (!trimmed) return null;

  // URL
  if (/^https?:\/\//i.test(trimmed)) {
    let url;
    try { url = new URL(trimmed); } catch { return null; }
    const hostPath = `${url.hostname}${url.pathname}`;
    return kebab(hostPath);
  }

  // File path. Make it project-relative so two devs critiquing the same
  // checkout get the same slug regardless of where their repo is cloned.
  const abs = path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
  let rel = path.relative(cwd, abs);
  // If the target is outside cwd, fall back to the basename so we still
  // produce a stable slug (vs the absolute path, which would include
  // home dirs / usernames).
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    rel = path.basename(abs);
  }
  if (!rel || rel === '.' || rel === '') return null;
  return kebab(rel);
}

function kebab(s) {
  const slug = s
    .toLowerCase()
    .replace(/[/\\.]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) return null;
  // Cap from the tail — the tail (filename) is more identifying than the
  // top-level directory.
  return slug.length <= SLUG_MAX ? slug : slug.slice(slug.length - SLUG_MAX).replace(/^-/, '');
}

/**
 * Filename-safe UTC ISO timestamp: hyphens for separators, trailing Z.
 * Plain colons aren't allowed on Windows filesystems.
 */
export function nowFilenameStamp(date = new Date()) {
  const iso = date.toISOString();           // 2026-05-12T18:30:00.123Z
  return iso.replace(/[:.]/g, '-').replace(/-\d+Z$/, 'Z');
}

/**
 * Write a snapshot for `slug`. `meta` carries the small structured frontmatter
 * keys read back by readTrend(). `body` is the human-readable critique
 * report (everything below the frontmatter).
 *
 * Returns the absolute path written.
 */
export function writeSnapshot({ slug, meta, body, cwd = process.cwd(), now = new Date() }) {
  if (!slug) throw new Error('writeSnapshot requires a slug');
  const dir = getCritiqueDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const timestamp = nowFilenameStamp(now);
  const filePath = path.join(dir, `${timestamp}__${slug}.md`);
  // Spread `meta` first so internally computed `timestamp` and `slug`
  // always win. Otherwise a caller-supplied meta blob (parsed from the
  // IMPECCABLE_CRITIQUE_META env var) could clobber them, leaving the
  // filename in disagreement with its frontmatter and corrupting trends.
  const front = serializeFrontmatter({ ...meta, timestamp, slug });
  fs.writeFileSync(filePath, `${front}\n${body.trim()}\n`, 'utf-8');
  return filePath;
}

function serializeFrontmatter(obj) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const str = typeof value === 'string' ? value : String(value);
    // Quote strings that contain : or # to keep parsing simple.
    const needsQuotes = typeof value === 'string' && /[:#]/.test(str);
    lines.push(`${key}: ${needsQuotes ? JSON.stringify(str) : str}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (/^".*"$/.test(value)) {
      try { value = JSON.parse(value); } catch { /* leave as-is */ }
    } else if (/^-?\d+$/.test(value)) {
      value = Number(value);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Return all snapshot files for `slug`, sorted oldest → newest.
 */
function listSnapshotsForSlug(slug, cwd) {
  const dir = getCritiqueDir(cwd);
  if (!fs.existsSync(dir)) return [];
  const suffix = `__${slug}.md`;
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * Return the most recent snapshot for `slug`, or null. Polish reads this
 * to find its fix backlog when the slug matches.
 */
export function readLatestSnapshot(slug, { cwd = process.cwd() } = {}) {
  const all = listSnapshotsForSlug(slug, cwd);
  if (!all.length) return null;
  const latest = all[all.length - 1];
  const body = fs.readFileSync(latest, 'utf-8');
  return { path: latest, body, meta: parseFrontmatter(body) };
}

/**
 * Return the last `limit` snapshots' frontmatter, oldest → newest.
 * Critique appends a one-line trend to its output using this.
 */
export function readTrend(slug, { limit = 5, cwd = process.cwd() } = {}) {
  const all = listSnapshotsForSlug(slug, cwd);
  const slice = all.slice(-limit);
  return slice.map((file) => parseFrontmatter(fs.readFileSync(file, 'utf-8')));
}

// ---- CLI ---------------------------------------------------------------

function main(argv) {
  const [cmd, ...args] = argv;
  switch (cmd) {
    case 'slug': {
      const slug = slugFromTarget(args[0]);
      if (!slug) { process.stderr.write('no stable slug for input\n'); process.exit(1); }
      process.stdout.write(`${slug}\n`);
      return;
    }
    case 'write': {
      const [slug, bodyFile] = args;
      if (!slug || !bodyFile) { process.stderr.write('usage: write <slug> <body-file>\n'); process.exit(1); }
      const raw = fs.readFileSync(bodyFile, 'utf-8');
      // The body file may be a full report. The caller passes the meta as
      // a JSON object on stdin if it wants structured frontmatter; otherwise
      // we write with minimal metadata.
      let meta = {};
      const metaArg = process.env.IMPECCABLE_CRITIQUE_META;
      if (metaArg) {
        try { meta = JSON.parse(metaArg); } catch { /* ignore */ }
      }
      const out = writeSnapshot({ slug, meta, body: raw });
      process.stdout.write(`${out}\n`);
      return;
    }
    case 'latest': {
      const latest = readLatestSnapshot(args[0]);
      if (!latest) { process.exit(2); }
      process.stdout.write(latest.body);
      return;
    }
    case 'trend': {
      const rows = readTrend(args[0], { limit: args[1] ? Number(args[1]) : 5 });
      process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
      return;
    }
    default:
      process.stderr.write('usage: critique-storage.mjs <slug|write|latest|trend> [args]\n');
      process.exit(1);
  }
}

// Why pathToFileURL: on Windows, import.meta.url is file:///D:/... (forward
// slashes) while process.argv[1] is D:\... (backslashes), so the naive
// `file://${process.argv[1]}` compare fails and main() never runs — the
// script silently exits 0. pathToFileURL normalizes both. (issue #155)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
