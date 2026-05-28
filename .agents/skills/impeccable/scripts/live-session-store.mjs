import fs from 'node:fs';
import path from 'node:path';
import { getLegacyLiveSessionsDir, getLiveSessionsDir } from './impeccable-paths.mjs';

const COMPLETED_PHASES = new Set(['completed', 'discarded']);

export function createLiveSessionStore({ cwd = process.cwd(), sessionId } = {}) {
  const rootDir = getLiveSessionsDir(cwd);
  const legacyRootDir = getLegacyLiveSessionsDir(cwd);
  fs.mkdirSync(rootDir, { recursive: true });
  const snapshotCache = new Map();

  function loadCachedOrRebuild(id) {
    const cached = snapshotCache.get(id);
    if (cached) return cached;
    const journalPath = getReadableJournalPath(id);
    const rebuilt = rebuildSnapshotFromJournal(journalPath, id);
    snapshotCache.set(id, rebuilt);
    return rebuilt;
  }

  function getReadableJournalPath(id) {
    const primary = getJournalPath(rootDir, id);
    if (fs.existsSync(primary)) return primary;
    const legacy = getJournalPath(legacyRootDir, id);
    if (fs.existsSync(legacy)) return legacy;
    return primary;
  }

  return {
    rootDir,
    legacyRootDir,
    appendEvent(event) {
      const normalized = normalizeEvent(event, sessionId);
      const journalPath = getJournalPath(rootDir, normalized.id);
      const snapshotPath = getSnapshotPath(rootDir, normalized.id);
      const legacyJournalPath = getJournalPath(legacyRootDir, normalized.id);
      if (!fs.existsSync(journalPath) && fs.existsSync(legacyJournalPath)) {
        fs.copyFileSync(legacyJournalPath, journalPath);
      }
      const prior = loadCachedOrRebuild(normalized.id);
      const seq = prior.nextSeq;
      const entry = {
        seq,
        id: normalized.id,
        type: normalized.type,
        ts: new Date().toISOString(),
        event: normalized,
      };
      fs.appendFileSync(journalPath, JSON.stringify(entry) + '\n');
      const next = applyEvent(prior.snapshot, entry, prior.diagnostics);
      snapshotCache.set(normalized.id, { snapshot: next, diagnostics: next.diagnostics || [], nextSeq: seq + 1 });
      writeSnapshot(snapshotPath, next);
      return next;
    },
    getSnapshot(id = sessionId, opts = {}) {
      if (!id) throw new Error('session id required');
      const journalPath = getReadableJournalPath(id);
      const snapshotPath = getSnapshotPath(rootDir, id);
      const rebuilt = rebuildSnapshotFromJournal(journalPath, id);
      snapshotCache.set(id, rebuilt);
      writeSnapshot(snapshotPath, rebuilt.snapshot);
      if (!opts.includeCompleted && COMPLETED_PHASES.has(rebuilt.snapshot.phase)) return null;
      return rebuilt.snapshot;
    },
    listActiveSessions() {
      const ids = new Set();
      for (const dir of [legacyRootDir, rootDir]) {
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
          if (name.endsWith('.jsonl')) ids.add(name.slice(0, -'.jsonl'.length));
        }
      }
      return [...ids]
        .sort()
        .map((id) => this.getSnapshot(id))
        .filter(Boolean);
    },
  };
}

function normalizeEvent(event, fallbackId) {
  if (!event || typeof event !== 'object') throw new Error('event object required');
  const id = event.id || fallbackId;
  if (!id || typeof id !== 'string') throw new Error('event id required');
  if (!event.type || typeof event.type !== 'string') throw new Error('event type required');
  return { ...event, id };
}

function getJournalPath(rootDir, id) {
  return path.join(rootDir, safeSessionId(id) + '.jsonl');
}

function getSnapshotPath(rootDir, id) {
  return path.join(rootDir, safeSessionId(id) + '.snapshot.json');
}

function safeSessionId(id) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('invalid session id: ' + id);
  return id;
}

function baseSnapshot(id) {
  return {
    id,
    phase: 'new',
    pageUrl: null,
    sourceFile: null,
    expectedVariants: 0,
    arrivedVariants: 0,
    visibleVariant: null,
    paramValues: {},
    pendingEventSeq: null,
    pendingEvent: null,
    deliveryLease: null,
    checkpointRevision: 0,
    activeOwner: null,
    sourceMarkers: {},
    fallbackMode: null,
    annotationArtifacts: [],
    diagnostics: [],
    updatedAt: null,
  };
}

function rebuildSnapshotFromJournal(journalPath, id) {
  let snapshot = baseSnapshot(id);
  const diagnostics = [];
  let nextSeq = 1;
  if (!fs.existsSync(journalPath)) return { snapshot, diagnostics, nextSeq };

  const lines = fs.readFileSync(journalPath, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (!entry || typeof entry !== 'object') throw new Error('entry is not object');
      if (Number.isInteger(entry.seq)) nextSeq = Math.max(nextSeq, entry.seq + 1);
      snapshot = applyEvent(snapshot, entry);
    } catch (err) {
      diagnostics.push({
        error: 'journal_parse_failed',
        line: i + 1,
        message: err.message,
      });
    }
  }
  snapshot.diagnostics = [...snapshot.diagnostics, ...diagnostics];
  return { snapshot, diagnostics, nextSeq };
}

function applyEvent(snapshot, entry, inheritedDiagnostics = []) {
  const event = entry.event || entry;
  const next = {
    ...snapshot,
    paramValues: { ...(snapshot.paramValues || {}) },
    sourceMarkers: { ...(snapshot.sourceMarkers || {}) },
    annotationArtifacts: [...(snapshot.annotationArtifacts || [])],
    diagnostics: [...(snapshot.diagnostics || [])],
    updatedAt: entry.ts || new Date().toISOString(),
  };

  if (inheritedDiagnostics.length && next.diagnostics.length === 0) {
    next.diagnostics = [...inheritedDiagnostics];
  }

  switch (event.type) {
    case 'generate':
      next.phase = 'generate_requested';
      next.pageUrl = event.pageUrl ?? next.pageUrl;
      next.expectedVariants = event.count ?? next.expectedVariants;
      next.pendingEventSeq = entry.seq ?? next.pendingEventSeq;
      next.pendingEvent = toPendingEvent(event);
      if (event.screenshotPath) upsertArtifact(next.annotationArtifacts, { type: 'screenshot', path: event.screenshotPath });
      break;
    case 'variants_ready':
    case 'agent_done':
      next.phase = event.carbonize === true ? 'carbonize_required' : 'variants_ready';
      next.sourceFile = event.file ?? next.sourceFile;
      next.arrivedVariants = event.arrivedVariants ?? (next.arrivedVariants ?? next.expectedVariants);
      next.pendingEventSeq = null;
      next.pendingEvent = null;
      if (event.carbonize === true) {
        next.diagnostics.push({
          error: 'carbonize_cleanup_required',
          file: event.file || null,
          message: 'Accepted variant still has carbonize markers that must be folded into source CSS.',
        });
      }
      break;
    case 'checkpoint':
      if ((event.revision ?? 0) >= (next.checkpointRevision ?? 0)) {
        next.phase = event.phase ?? next.phase;
        next.checkpointRevision = event.revision ?? next.checkpointRevision;
        next.activeOwner = event.owner ?? next.activeOwner;
        next.arrivedVariants = event.arrivedVariants ?? next.arrivedVariants;
        next.visibleVariant = event.visibleVariant ?? next.visibleVariant;
        if (event.paramValues) next.paramValues = { ...event.paramValues };
      } else {
        next.diagnostics.push({ error: 'stale_checkpoint_ignored', revision: event.revision });
      }
      break;
    case 'accept':
    case 'accept_intent':
      next.phase = 'accept_requested';
      next.visibleVariant = Number(event.variantId ?? next.visibleVariant);
      if (event.paramValues) next.paramValues = { ...event.paramValues };
      next.pendingEventSeq = entry.seq ?? next.pendingEventSeq;
      next.pendingEvent = toPendingEvent(event);
      break;
    case 'discard':
      next.phase = 'discard_requested';
      next.pendingEventSeq = entry.seq ?? next.pendingEventSeq;
      next.pendingEvent = toPendingEvent(event);
      break;
    case 'discarded':
      next.phase = 'discarded';
      next.pendingEventSeq = null;
      next.pendingEvent = null;
      break;
    case 'complete':
      next.phase = 'completed';
      next.pendingEventSeq = null;
      next.pendingEvent = null;
      break;
    case 'agent_error':
      next.phase = 'agent_error';
      next.pendingEventSeq = null;
      next.pendingEvent = null;
      next.diagnostics.push({ error: 'agent_error', message: event.message || 'unknown agent error' });
      break;
    default:
      next.diagnostics.push({ error: 'unknown_event_type', type: event.type });
      break;
  }
  return next;
}

function toPendingEvent(event) {
  const pending = { ...event };
  delete pending.token;
  return pending;
}

function upsertArtifact(artifacts, artifact) {
  if (!artifacts.some((existing) => existing.path === artifact.path && existing.type === artifact.type)) {
    artifacts.push(artifact);
  }
}

function writeSnapshot(snapshotPath, snapshot) {
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
}
