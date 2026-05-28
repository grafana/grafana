#!/usr/bin/env node
/**
 * Pin/unpin sub-commands as standalone skill shortcuts.
 *
 * Usage:
 *   node <scripts_path>/pin.mjs pin <command>
 *   node <scripts_path>/pin.mjs unpin <command>
 *
 * `pin audit` creates a lightweight /audit skill that redirects to /impeccable audit.
 * `unpin audit` removes that shortcut.
 *
 * The script discovers harness directories (.claude/skills, .cursor/skills, etc.)
 * in the project root and creates/removes the pin in all of them.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// All known harness directories
const HARNESS_DIRS = [
  '.claude', '.cursor', '.gemini', '.codex', '.agents',
  '.trae', '.trae-cn', '.pi', '.opencode', '.kiro', '.rovodev',
];

// Valid sub-command names
const VALID_COMMANDS = [
  'craft', 'teach', 'extract', 'document', 'shape',
  'critique', 'audit',
  'polish', 'bolder', 'quieter', 'distill', 'harden', 'onboard', 'live',
  'animate', 'colorize', 'typeset', 'layout', 'delight', 'overdrive',
  'clarify', 'adapt', 'optimize',
];

// Marker to identify pinned skills (so unpin doesn't delete user skills)
const PIN_MARKER = '<!-- impeccable-pinned-skill -->';

/**
 * Walk up from startDir to find a project root.
 */
function findProjectRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  while (dir !== '/') {
    if (
      existsSync(join(dir, 'package.json')) ||
      existsSync(join(dir, '.git')) ||
      existsSync(join(dir, 'skills-lock.json'))
    ) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir);
}

/**
 * Find harness skill directories that have an impeccable skill installed.
 */
function findHarnessDirs(projectRoot) {
  const dirs = [];
  for (const harness of HARNESS_DIRS) {
    const skillsDir = join(projectRoot, harness, 'skills');
    // Only pin in harness dirs that already have impeccable installed
    const impeccableDir = join(skillsDir, 'impeccable');
    if (existsSync(impeccableDir) || existsSync(join(skillsDir, 'i-impeccable'))) {
      dirs.push(skillsDir);
    }
  }
  return dirs;
}

/**
 * Load command metadata (descriptions for pinned skills).
 */
function loadCommandMetadata() {
  const metadataPath = join(__dirname, 'command-metadata.json');
  if (existsSync(metadataPath)) {
    return JSON.parse(readFileSync(metadataPath, 'utf-8'));
  }
  return {};
}

/**
 * Generate a pinned skill's SKILL.md content.
 */
function generatePinnedSkill(command, metadata) {
  const desc = metadata[command]?.description || `Shortcut for /impeccable ${command}.`;
  const hint = metadata[command]?.argumentHint || '[target]';

  return `---
name: ${command}
description: "${desc}"
argument-hint: "${hint}"
user-invocable: true
---

${PIN_MARKER}

This is a pinned shortcut for \`{{command_prefix}}impeccable ${command}\`.

Invoke {{command_prefix}}impeccable ${command}, passing along any arguments provided here, and follow its instructions.
`;
}

/**
 * Pin a command: create shortcut skill in all harness dirs.
 */
function pin(command, projectRoot) {
  const metadata = loadCommandMetadata();
  const harnessDirs = findHarnessDirs(projectRoot);

  if (harnessDirs.length === 0) {
    console.log('No harness directories with impeccable installed found.');
    return false;
  }

  const content = generatePinnedSkill(command, metadata);
  let created = 0;

  for (const skillsDir of harnessDirs) {
    // Check if skill already exists (and isn't a pin)
    const skillDir = join(skillsDir, command);
    if (existsSync(skillDir)) {
      const existingMd = join(skillDir, 'SKILL.md');
      if (existsSync(existingMd)) {
        const existing = readFileSync(existingMd, 'utf-8');
        if (!existing.includes(PIN_MARKER)) {
          console.log(`  SKIP: ${skillDir} (non-pinned skill already exists)`);
          continue;
        }
      }
    }

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8');
    console.log(`  + ${skillDir}`);
    created++;
  }

  if (created > 0) {
    console.log(`\nPinned '${command}' as a standalone shortcut in ${created} location(s).`);
    console.log(`You can now use /${command} directly.`);
  }

  return created > 0;
}

/**
 * Unpin a command: remove shortcut skill from all harness dirs.
 */
function unpin(command, projectRoot) {
  const harnessDirs = findHarnessDirs(projectRoot);
  let removed = 0;

  for (const skillsDir of harnessDirs) {
    const skillDir = join(skillsDir, command);
    if (!existsSync(skillDir)) continue;

    const skillMd = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) continue;

    // Safety: only remove if it's a pinned skill
    const content = readFileSync(skillMd, 'utf-8');
    if (!content.includes(PIN_MARKER)) {
      console.log(`  SKIP: ${skillDir} (not a pinned skill)`);
      continue;
    }

    rmSync(skillDir, { recursive: true, force: true });
    console.log(`  - ${skillDir}`);
    removed++;
  }

  if (removed > 0) {
    console.log(`\nUnpinned '${command}' from ${removed} location(s).`);
    console.log(`Use /impeccable ${command} to access it.`);
  } else {
    console.log(`No pinned '${command}' shortcut found.`);
  }

  return removed > 0;
}

// --- CLI ---
const [,, action, command] = process.argv;

if (!action || !command) {
  console.log('Usage: node pin.mjs <pin|unpin> <command>');
  console.log(`\nAvailable commands: ${VALID_COMMANDS.join(', ')}`);
  process.exit(1);
}

if (action !== 'pin' && action !== 'unpin') {
  console.error(`Unknown action: ${action}. Use 'pin' or 'unpin'.`);
  process.exit(1);
}

if (!VALID_COMMANDS.includes(command)) {
  console.error(`Unknown command: ${command}`);
  console.error(`Available commands: ${VALID_COMMANDS.join(', ')}`);
  process.exit(1);
}

const root = findProjectRoot();

if (action === 'pin') {
  pin(command, root);
} else {
  unpin(command, root);
}
