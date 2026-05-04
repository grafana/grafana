import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { Project, type SourceFile } from 'ts-morph';

import { findAllEvents } from './findAllEvents.mts';
import { formatEventsAsMarkdown } from './generateMarkdown.mts';

const FAKE_RUNTIME = `
  export type EventProperty = Record<string, unknown>;
  export interface DefineFeatureEventsOptions { silent?: boolean }
  type Factory = <P extends EventProperty | undefined = undefined>(
    eventName: string,
    eventOptions?: DefineFeatureEventsOptions
  ) => (props: P extends undefined ? void : P) => void;
  export const defineFeatureEvents: (
    repo: string,
    feature: string,
    defaultProps?: EventProperty,
    factoryOptions?: DefineFeatureEventsOptions
  ) => Factory = (() => () => () => {}) as never;
`;

const buildProject = (sources: Record<string, string>) => {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { strict: false, target: 99, module: 99 },
  });
  project.createSourceFile('runtime.ts', FAKE_RUNTIME);
  const files: SourceFile[] = [];
  for (const [name, content] of Object.entries(sources)) {
    files.push(project.createSourceFile(name, content));
  }
  return files;
};

const findEvent = (events: ReturnType<typeof findAllEvents>, name: string) => {
  const event = events.find((e) => e.eventName === name);
  if (!event) {
    throw new Error(`event ${name} not found`);
  }
  return event;
};

describe('analytics report — silent extraction', () => {
  it('marks per-event silent: true (loud factory + silent override)', () => {
    const files = buildProject({
      'feature.ts': `
        import { defineFeatureEvents } from './runtime';
        const factory = defineFeatureEvents('grafana', 'mixed');
        /**
         * Loud event.
         * @owner grafana-test
         */
        export const loud = factory('loud_event');
        /**
         * Silent override.
         * @owner grafana-test
         */
        export const silent = factory('silent_event', { silent: true });
      `,
    });

    const events = findAllEvents(files, './runtime');

    assert.equal(findEvent(events, 'loud_event').silent, undefined);
    assert.equal(findEvent(events, 'silent_event').silent, true);
  });

  it('inherits factory-level silent: true on all events', () => {
    const files = buildProject({
      'feature.ts': `
        import { defineFeatureEvents } from './runtime';
        const factory = defineFeatureEvents('grafana', 'cuj', undefined, { silent: true });
        /**
         * Inherited silent.
         * @owner grafana-test
         */
        export const a = factory('a');
        /**
         * Also inherited.
         * @owner grafana-test
         */
        export const b = factory('b');
      `,
    });

    const events = findAllEvents(files, './runtime');

    assert.equal(findEvent(events, 'a').silent, true);
    assert.equal(findEvent(events, 'b').silent, true);
  });

  it('per-event silent: false overrides factory-level silent: true', () => {
    const files = buildProject({
      'feature.ts': `
        import { defineFeatureEvents } from './runtime';
        const factory = defineFeatureEvents('grafana', 'cuj', undefined, { silent: true });
        /**
         * Inherited silent.
         * @owner grafana-test
         */
        export const inherited = factory('inherited');
        /**
         * Override back to loud.
         * @owner grafana-test
         */
        export const loud = factory('loud_override', { silent: false });
      `,
    });

    const events = findAllEvents(files, './runtime');

    assert.equal(findEvent(events, 'inherited').silent, true);
    assert.equal(findEvent(events, 'loud_override').silent, false);
  });

  it('treats omitted silent as undefined', () => {
    const files = buildProject({
      'feature.ts': `
        import { defineFeatureEvents } from './runtime';
        const factory = defineFeatureEvents('grafana', 'plain');
        /**
         * No options.
         * @owner grafana-test
         */
        export const a = factory('a');
      `,
    });

    const events = findAllEvents(files, './runtime');

    assert.equal(findEvent(events, 'a').silent, undefined);
  });

  it('omits silent events from the markdown report entirely', async () => {
    const files = buildProject({
      'feature.ts': `
        import { defineFeatureEvents } from './runtime';
        const factory = defineFeatureEvents('grafana', 'feature_x');
        /**
         * Loud event.
         * @owner grafana-test
         */
        export const loud = factory('loud_event');
        /**
         * Silent event.
         * @owner grafana-test
         */
        export const quiet = factory('silent_event', { silent: true });
      `,
    });

    const events = findAllEvents(files, './runtime');
    const markdown = await formatEventsAsMarkdown(events);

    assert.match(markdown, /grafana_feature_x_loud_event/);
    assert.doesNotMatch(markdown, /grafana_feature_x_silent_event/);
  });

  it('drops a feature section entirely when all its events are silent', async () => {
    const files = buildProject({
      'feature.ts': `
        import { defineFeatureEvents } from './runtime';
        const factory = defineFeatureEvents('grafana', 'all_silent', undefined, { silent: true });
        /**
         * Inherited silent.
         * @owner grafana-test
         */
        export const a = factory('a');
        /**
         * Also inherited.
         * @owner grafana-test
         */
        export const b = factory('b');
      `,
    });

    const events = findAllEvents(files, './runtime');
    const markdown = await formatEventsAsMarkdown(events);

    assert.doesNotMatch(markdown, /all_silent/);
  });

  it('preserves silent on EventData for non-markdown consumers', () => {
    const files = buildProject({
      'feature.ts': `
        import { defineFeatureEvents } from './runtime';
        const factory = defineFeatureEvents('grafana', 'feature_x');
        /**
         * Silent event.
         * @owner grafana-test
         */
        export const quiet = factory('silent_event', { silent: true });
      `,
    });

    const events = findAllEvents(files, './runtime');

    assert.equal(findEvent(events, 'silent_event').silent, true);
  });
});
