import {
  type PluginExtensionCommandPaletteSearchProvider,
  type PluginExtensionFunction,
  PluginExtensionPoints,
} from '@grafana/data';
import { isRecord } from 'app/core/utils/isRecord';
import { type ExtensionsLog, log as baseLog } from 'app/features/plugins/extensions/logs/log';
import { getLinkExtensionPathWithTracking } from 'app/features/plugins/extensions/utils';
import { isPromise } from 'app/features/plugins/extensions/validators';

import { type CommandPaletteAction } from '../types';
import { SEARCH_RESULTS_PRIORITY, SECTION_EXTENSION_SEARCH } from '../values';

const MAX_RESULTS_PER_PROVIDER = 5;
const PROVIDER_TIMEOUT_MS = 3000;
// Only used to tell whether a path stays on the Grafana origin.
const PLACEHOLDER_ORIGIN = 'http://grafana.invalid';

type SearchExtension = PluginExtensionFunction<PluginExtensionCommandPaletteSearchProvider>;

export interface ExtensionSearchSection {
  id: string;
  title: string;
  actions: CommandPaletteAction[];
}

interface ParsedResult {
  id: string;
  title: string;
  description?: string;
  path?: string;
  onSelect?: () => void | Promise<void>;
}

/**
 * Runs every provider and calls `onSection` as each one settles, with no actions when it failed or timed out.
 * One failing provider never affects the others.
 */
export async function searchExtensionProviders(
  providers: SearchExtension[],
  searchQuery: string,
  signal: AbortSignal,
  onSection: (section: ExtensionSearchSection) => void
): Promise<void> {
  await Promise.allSettled(
    providers.map(async (extension) => {
      const actions = await runProvider(extension, searchQuery, signal);
      onSection({ id: extension.id, title: extension.title, actions });
    })
  );
}

async function runProvider(
  extension: SearchExtension,
  searchQuery: string,
  parentSignal: AbortSignal
): Promise<CommandPaletteAction[]> {
  if (parentSignal.aborted) {
    return [];
  }

  const log = baseLog.child({
    pluginId: extension.pluginId,
    extensionPointId: PluginExtensionPoints.CommandPaletteSearch,
  });
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, PROVIDER_TIMEOUT_MS);

  // The race lets a provider that ignores its signal still be discarded on timeout or abort.
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
      once: true,
    });
  });

  try {
    const found: unknown = await Promise.race([extension.fn({ searchQuery, signal: controller.signal }), aborted]);
    if (!Array.isArray(found)) {
      log.error('Command palette search provider did not return an array');
      return [];
    }
    return toActions(extension, found, log);
  } catch (error) {
    if (!isAbortError(error)) {
      logFailure(log, 'Command palette search provider failed', error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
    parentSignal.removeEventListener('abort', abort);
  }
}

function toActions(extension: SearchExtension, found: unknown[], log: ExtensionsLog): CommandPaletteAction[] {
  const actions: CommandPaletteAction[] = [];
  const seenIds = new Set<string>();

  for (const value of found) {
    if (actions.length >= MAX_RESULTS_PER_PROVIDER) {
      break;
    }

    const parsed = parseResult(value);
    if ('error' in parsed) {
      log.warning(`Dropped a command palette search result: ${parsed.error}`);
      continue;
    }
    if (seenIds.has(parsed.id)) {
      continue;
    }
    seenIds.add(parsed.id);
    actions.push(toAction(extension, parsed, log));
  }

  return actions;
}

function toAction(extension: SearchExtension, result: ParsedResult, log: ExtensionsLog): CommandPaletteAction {
  const { onSelect } = result;
  return {
    id: `extension-search/${extension.pluginId}/${result.id}`,
    name: result.title,
    subtitle: result.description,
    section: extension.title,
    sectionId: SECTION_EXTENSION_SEARCH,
    priority: SEARCH_RESULTS_PRIORITY,
    // An action with perform has its URL navigation blocked, so only set it when there is a handler.
    perform: onSelect ? () => runOnSelect(onSelect, log) : undefined,
    url: result.path
      ? getLinkExtensionPathWithTracking(extension.pluginId, result.path, PluginExtensionPoints.CommandPaletteSearch)
      : undefined,
  };
}

// Must never throw: the palette only closes after perform returns.
function runOnSelect(onSelect: () => void | Promise<void>, log: ExtensionsLog) {
  try {
    const result = onSelect();
    if (isPromise(result)) {
      result.catch((error) => logFailure(log, 'Command palette search result onSelect failed', error));
    }
  } catch (error) {
    logFailure(log, 'Command palette search result onSelect failed', error);
  }
}

function parseResult(value: unknown): ParsedResult | { error: string } {
  if (!isRecord(value)) {
    return { error: 'not an object' };
  }
  const { id, title, description, path, onSelect } = value;

  if (typeof id !== 'string' || id === '') {
    return { error: 'id must be a non-empty string' };
  }
  if (typeof title !== 'string' || title === '') {
    return { error: `title of "${id}" must be a non-empty string` };
  }
  if (description !== undefined && typeof description !== 'string') {
    return { error: `description of "${id}" must be a string` };
  }
  if (path !== undefined && typeof path !== 'string') {
    return { error: `path of "${id}" must be a string` };
  }
  if (onSelect !== undefined && typeof onSelect !== 'function') {
    return { error: `onSelect of "${id}" must be a function` };
  }
  if (path === undefined && onSelect === undefined) {
    return { error: `"${id}" needs a path or an onSelect` };
  }
  if (path !== undefined && !isAppRelativePath(path)) {
    return { error: `path of "${id}" must be relative to the Grafana root, such as "/a/my-plugin/page"` };
  }

  return { id, title, description, path, onSelect: onSelect ? () => onSelect() : undefined };
}

// Parsing also catches what browsers normalize away, such as a tab inside "/\t/host" turning it into "//host".
function isAppRelativePath(path: string): boolean {
  if (!path.startsWith('/')) {
    return false;
  }
  try {
    return new URL(path, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
  } catch {
    return false;
  }
}

function logFailure(log: ExtensionsLog, message: string, error: unknown) {
  const cause = error instanceof Error ? error : new Error(String(error));
  log.error(`${message}: ${cause.message}`, { message: cause.message, stack: cause.stack ?? '' });
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}
