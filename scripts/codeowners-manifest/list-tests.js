#!/usr/bin/env node

// Reads newline-separated test file paths on stdin, prints one JSON object per
// line (JSONL): { file, startLine, endLine, name }. `file` is relative to the
// project root and startLine-endLine spans the whole test block so it can be
// read back for analysis. `name` is the full "describe > … > it" path. No test
// bodies are executed.
const { parse } = require('jest-editor-support');
const fs = require('node:fs');
const path = require('node:path');

const files = fs
  .readFileSync(0, 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

let ok = 0;
let failed = 0;
for (const file of files) {
  let root;
  try {
    ({ root } = parse(file));
  } catch (err) {
    failed++;
    process.stderr.write(`parse-fail\t${file}\t${err.message.split('\n')[0]}\n`);
    continue;
  }
  ok++;
  const relFile = path.relative(process.cwd(), file);
  const walk = (node, trail) => {
    if (!node) {
      return;
    }
    const next = node.name !== undefined ? [...trail, node.name] : trail;
    if (node.type === 'it') {
      const startLine = node.start ? node.start.line : null;
      const endLine = node.end ? node.end.line : startLine;
      process.stdout.write(JSON.stringify({ file: relFile, startLine, endLine, name: next.join(' > ') }) + '\n');
    }
    (node.children || []).forEach((c) => walk(c, next));
  };
  walk(root, []);
}

process.stderr.write(`\nparsed ${ok} files, ${failed} failed\n`);
