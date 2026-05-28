#!/usr/bin/env node
/**
 * Recover the next agent action from the durable live-session journal.
 */

import { createLiveSessionStore } from './live-session-store.mjs';

function parseArgs(argv) {
  const out = { id: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--id') out.id = argv[++i];
    else if (arg.startsWith('--id=')) out.id = arg.slice('--id='.length);
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

export async function resumeCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node live-resume.mjs [--id SESSION_ID]\n\nPrint the active durable session checkpoint and the next safe agent action.`);
    return;
  }

  const store = createLiveSessionStore({ cwd: process.cwd(), sessionId: args.id || undefined });
  const snapshot = args.id ? store.getSnapshot(args.id) : store.listActiveSessions()[0] || null;
  if (!snapshot) {
    console.log(JSON.stringify({ active: false, nextAction: 'No active durable live session found.' }, null, 2));
    return;
  }

  const pending = snapshot.pendingEvent || null;
  const nextAction = pending
    ? `Run live-poll.mjs, handle ${pending.type} ${pending.id}, then acknowledge with live-poll.mjs --reply ${pending.id} done.`
    : snapshot.phase === 'carbonize_required'
      ? `Finish carbonize cleanup${snapshot.sourceFile ? ` in ${snapshot.sourceFile}` : ''}, then run live-complete.mjs --id ${snapshot.id}.`
      : snapshot.phase === 'accept_requested'
        ? `Run live-complete.mjs --id ${snapshot.id} after verifying the accepted variant is written.`
        : `Inspect ${snapshot.id}; no pending agent event is currently queued.`;

  console.log(JSON.stringify({ active: true, snapshot, pendingEvent: pending, nextAction }, null, 2));
}

const _running = process.argv[1];
if (_running?.endsWith('live-resume.mjs') || _running?.endsWith('live-resume.mjs/')) {
  resumeCli();
}
