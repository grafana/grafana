import { type Page } from '@playwright/test';

import type { JourneyOutcome, JourneyRecord, JourneyRecorder, JourneyStepRecord } from './types';

/**
 * Enable journey debug logging and create a recorder that captures
 * all JourneyTracker console output into structured records.
 *
 * Must be called BEFORE the page navigates to Grafana (the localStorage
 * must be set before the app boots). Works with page.addInitScript.
 *
 * Uses msg.args() for structured data extraction instead of parsing
 * msg.text() - avoids [object Object] serialization issues.
 *
 * The debug log format (from createDebugLog) is:
 *   console.log(`[JourneyTracker] ${verb}`, contextString, dataObject)
 *
 * So msg.args() gives us:
 *   [0] = '[JourneyTracker] startJourney'   (prefix + verb)
 *   [1] = 'search_to_resource'              (type / context)
 *   [2] = { journeyId, timeoutMs, ... }     (data payload)
 */
export async function createJourneyRecorder(page: Page): Promise<JourneyRecorder> {
  // Set localStorage before any navigation so debug logging is active at boot
  await page.addInitScript(() => {
    localStorage.setItem('grafana.debug.journeyTracker', 'true');
  });

  const rawLogs: string[] = [];
  const completedJourneys: JourneyRecord[] = [];

  // In-flight journey state keyed by journeyId
  const activeJourneys = new Map<
    string,
    {
      journeyType: string;
      journeyId: string;
      steps: JourneyStepRecord[];
      attributeUpdates: Array<Record<string, string>>;
      concurrentJourneys: number;
      rawLogs: string[];
    }
  >();

  // journeyType -> journeyId index for lookup
  const typeToId = new Map<string, string>();

  // Waiters
  const endWaiters = new Map<string, Array<(record: JourneyRecord) => void>>();
  const startWaiters = new Map<string, Array<(journeyId: string) => void>>();

  page.on('console', async (msg) => {
    // Quick filter on msg.text() before doing async arg resolution.
    // msg.text() is synchronously available and cheap.
    const text = msg.text();
    if (!text.startsWith('[JourneyTracker]') && !text.startsWith('[JourneyRegistry]')) {
      return;
    }

    rawLogs.push(text);

    // Resolve args for structured parsing.
    // console.log(`[${prefix}] ${verb}`, contextString, dataObject)
    //   args[0] = '[JourneyTracker] verb'
    //   args[1] = context string (journeyType, journeyType/stepName, journeyType -> outcome)
    //   args[2] = data payload object (if present)
    const args = msg.args();
    let prefix: string;
    let contextStr: string | undefined;
    let payload: Record<string, unknown> | null = null;

    try {
      prefix = (await args[0]?.jsonValue()) as string;
      if (typeof prefix !== 'string') {
        return;
      }
    } catch {
      return;
    }

    try {
      const raw = args.length > 1 ? await args[1]?.jsonValue() : undefined;
      contextStr = typeof raw === 'string' ? raw : undefined;
    } catch {
      contextStr = undefined;
    }

    try {
      const raw = args.length > 2 ? await args[2]?.jsonValue() : undefined;
      payload = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    } catch {
      payload = null;
    }

    // startJourney: prefix = '[JourneyTracker] startJourney', contextStr = journeyType
    if (prefix.includes('startJourney') && contextStr) {
      const journeyType = contextStr;
      const journeyId = String(payload?.journeyId ?? '');
      const concurrentJourneys = Number(payload?.concurrentJourneys ?? 0);

      activeJourneys.set(journeyId, {
        journeyType,
        journeyId,
        steps: [],
        attributeUpdates: [],
        concurrentJourneys,
        rawLogs: [text],
      });
      typeToId.set(journeyType, journeyId);

      // Resolve start waiters
      const waiters = startWaiters.get(journeyType);
      if (waiters) {
        for (const resolve of waiters) {
          resolve(journeyId);
        }
        startWaiters.delete(journeyType);
      }
    }

    // addStep: prefix = '[JourneyTracker] addStep', contextStr = 'journeyType/stepName'
    if (prefix.includes('addStep') && contextStr) {
      const slashIdx = contextStr.indexOf('/');
      if (slashIdx !== -1) {
        const journeyType = contextStr.slice(0, slashIdx);
        const stepName = contextStr.slice(slashIdx + 1);
        const journeyId = String(payload?.journeyId ?? typeToId.get(journeyType) ?? '');
        const active = activeJourneys.get(journeyId);
        if (active) {
          active.steps.push({
            name: stepName,
            stepNumber: Number(payload?.stepNumber ?? active.steps.length + 1),
            attributes: payload?.attributes as Record<string, string> | undefined,
          });
          active.rawLogs.push(text);
        }
      }
    }

    // setAttributes: prefix = '[JourneyTracker] setAttributes', contextStr = journeyType
    // Note: setAttributes uses only 2 console.log args (prefix, journeyType) + attrs as 3rd
    // But actually: debugLog('setAttributes', this.journeyType, attrs) =>
    //   console.log('[JourneyTracker] setAttributes', journeyType, attrs)
    if (prefix.includes('setAttributes') && contextStr) {
      const journeyType = contextStr;
      const journeyId = typeToId.get(journeyType);
      if (journeyId && payload) {
        const active = activeJourneys.get(journeyId);
        if (active) {
          active.attributeUpdates.push(payload as Record<string, string>);
          active.rawLogs.push(text);
        }
      }
    }

    // end: prefix = '[JourneyTracker] end', contextStr = 'journeyType -> outcome'
    if (prefix.includes('] end') && contextStr) {
      const arrowIdx = contextStr.indexOf(' -> ');
      if (arrowIdx !== -1) {
        const journeyType = contextStr.slice(0, arrowIdx);
        const outcome = contextStr.slice(arrowIdx + 4) as JourneyOutcome;
        const journeyId = String(payload?.journeyId ?? typeToId.get(journeyType) ?? '');
        const active = activeJourneys.get(journeyId);

        const record: JourneyRecord = {
          journeyType,
          journeyId,
          outcome,
          durationMs: Number(payload?.durationMs ?? 0),
          stepCount: Number(payload?.stepCount ?? 0),
          attributes: (payload?.attributes as Record<string, string>) ?? {},
          steps: active?.steps ?? [],
          attributeUpdates: active?.attributeUpdates ?? [],
          concurrentJourneys: active?.concurrentJourneys ?? 0,
          rawLogs: [...(active?.rawLogs ?? []), text],
        };

        completedJourneys.push(record);
        activeJourneys.delete(journeyId);

        // Resolve end waiters
        const waiters = endWaiters.get(journeyType);
        if (waiters) {
          for (const resolve of waiters) {
            resolve(record);
          }
          endWaiters.delete(journeyType);
        }
      }
    }
  });

  return {
    waitForJourneyEnd(journeyType: string, timeoutMs = 15_000): Promise<JourneyRecord> {
      // Check if already completed
      const existing = completedJourneys.find((j) => j.journeyType === journeyType);
      if (existing) {
        return Promise.resolve(existing);
      }

      return new Promise<JourneyRecord>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for journey "${journeyType}" to end after ${timeoutMs}ms.\n` +
                `Captured logs:\n${rawLogs.join('\n')}`
            )
          );
        }, timeoutMs);

        let waiters = endWaiters.get(journeyType);
        if (!waiters) {
          waiters = [];
          endWaiters.set(journeyType, waiters);
        }
        waiters.push((record) => {
          clearTimeout(timer);
          resolve(record);
        });
      });
    },

    waitForJourneyStart(journeyType: string, timeoutMs = 10_000): Promise<string> {
      // Check if already started
      const id = typeToId.get(journeyType);
      if (id) {
        return Promise.resolve(id);
      }

      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for journey "${journeyType}" to start after ${timeoutMs}ms.\n` +
                `Captured logs:\n${rawLogs.join('\n')}`
            )
          );
        }, timeoutMs);

        let waiters = startWaiters.get(journeyType);
        if (!waiters) {
          waiters = [];
          startWaiters.set(journeyType, waiters);
        }
        waiters.push((journeyId) => {
          clearTimeout(timer);
          resolve(journeyId);
        });
      });
    },

    getCompletedJourneys(): JourneyRecord[] {
      return [...completedJourneys];
    },

    getRawLogs(): string[] {
      return [...rawLogs];
    },

    dispose(): void {
      endWaiters.clear();
      startWaiters.clear();
    },
  };
}
