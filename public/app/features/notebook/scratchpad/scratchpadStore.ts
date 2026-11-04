import { useSyncExternalStore } from 'react';

import { store as localStore } from '@grafana/data';

import { type AppendedElement } from '../addPanel/appendPanelToNotebook';
import { type PanelElement } from '../types';

export type ScratchBlock = { id: string } & AppendedElement;

export interface Scratchpad {
  title: string;
  blocks: ScratchBlock[];
}

const STORAGE_KEY = 'grafana.notebooks.scratchpad';
const HEADING_PREFIX = '# ';

const EMPTY: Scratchpad = { title: '', blocks: [] };

// Module state rather than context: the dashboard panel menu and Explore's toolbar add to it from outside the sidebar's tree.
let current: Scratchpad = load();
const listeners = new Set<() => void>();

function isBlock(value: unknown): value is ScratchBlock {
  if (typeof value !== 'object' || value === null || !('id' in value) || !('kind' in value)) {
    return false;
  }
  if (value.kind === 'markdown') {
    return 'text' in value && typeof value.text === 'string';
  }
  return value.kind === 'panel' && 'panel' in value;
}

function load(): Scratchpad {
  try {
    const raw: unknown = JSON.parse(localStore.get(STORAGE_KEY) ?? 'null');
    if (typeof raw === 'object' && raw !== null && 'blocks' in raw && Array.isArray(raw.blocks)) {
      const title = 'title' in raw && typeof raw.title === 'string' ? raw.title : '';
      return { title, blocks: raw.blocks.filter(isBlock) };
    }
  } catch {
    // Corrupt or unavailable storage: start empty.
  }
  return EMPTY;
}

function commit(next: Scratchpad) {
  current = next;
  try {
    localStore.set(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or blocked storage: the draft still works for this session.
  }
  listeners.forEach((listener) => listener());
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `s${Date.now().toString(36)}${counter}`;
}

export function getScratchpad(): Scratchpad {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useScratchpad(): Scratchpad {
  return useSyncExternalStore(subscribe, getScratchpad);
}

export function isHeading(text: string): boolean {
  return text.startsWith(HEADING_PREFIX);
}

/** Flips a text block between paragraph and heading by toggling the markdown prefix. */
export function toggleHeadingText(text: string): string {
  return isHeading(text) ? text.slice(HEADING_PREFIX.length) : `${HEADING_PREFIX}${text}`;
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

export function addNote(text: string): void {
  const trimmed = text.trim();
  if (trimmed) {
    commit({ ...current, blocks: [...current.blocks, { id: newId(), kind: 'markdown', text: trimmed }] });
  }
}

export function addPanel(panel: PanelElement, isLibraryPanel = false): void {
  commit({ ...current, blocks: [...current.blocks, { id: newId(), kind: 'panel', panel, isLibraryPanel }] });
}

export function updateText(id: string, text: string): void {
  commit({
    ...current,
    blocks: current.blocks.map((block) => (block.id === id && block.kind === 'markdown' ? { ...block, text } : block)),
  });
}

export function toggleHeading(id: string): void {
  commit({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === id && block.kind === 'markdown' ? { ...block, text: toggleHeadingText(block.text) } : block
    ),
  });
}

export function removeBlock(id: string): void {
  commit({ ...current, blocks: current.blocks.filter((block) => block.id !== id) });
}

export function moveBlock(from: number, to: number): void {
  commit({ ...current, blocks: moveItem(current.blocks, from, to) });
}

export function setTitle(title: string): void {
  commit({ ...current, title });
}

export function clearScratchpad(): void {
  commit(EMPTY);
}

/** Test seam: re-reads storage, as a fresh page load would. */
export function reloadScratchpadFromStorage(): void {
  current = load();
  listeners.forEach((listener) => listener());
}
