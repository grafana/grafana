import * as tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';

import defineFeatureEventsRule from '../rules/define-feature-events.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    // Imported rather than required: this package is an ES module, so `require` is not defined here.
    parser: tsParser,
  },
});

const ruleTester = new RuleTester();

const DEFINE_EVENTS_IMPORT = `import { defineFeatureEvents } from '@grafana/runtime/internal';`;
const EVENT_PROPERTY_IMPORT = `import { EventProperty } from '@grafana/runtime/internal';`;

ruleTester.run('define-feature-events', defineFeatureEventsRule, {
  valid: [
    // Full valid defineFeatureEvents usage
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        export const MyInteractions = {
          /** Fires when loaded. */
          loaded: createEvent('loaded'),
        };
      `,
    },
    // Arrow wrapper variant is also valid
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        export const MyInteractions = {
          /** Fires when the variant item is clicked. */
          itemClicked: (props) => createEvent('item_clicked')({ ...props, featureVariant: 'foo' }),
        };
      `,
    },
    // Valid EventProperty interface with all properties documented
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          /** Total number of items visible at load time. */
          numberOfItems: number;
        }
      `,
    },
    // Files with no relevant imports are ignored entirely
    {
      code: `export const foo = { bar: someOtherFn('x') };`,
    },
    // Individually exported event with a description
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'homepage');
        /** Fires once when the homepage first renders. */
        export const homepageViewed = createEvent('viewed');
      `,
    },
    // A line comment above a single JSDoc block is not a second description
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          // TODO: rename this property
          /** Total number of items visible at load time. */
          numberOfItems: number;
        }
      `,
    },
    // Neither is an eslint directive
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        export const MyInteractions = {
          // eslint-disable-next-line no-console
          /** Fires when loaded. */
          loaded: createEvent('loaded'),
        };
      `,
    },
    // Nor a plain block comment, which carries no description for the report
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          /* internal note */
          /** Total number of items visible at load time. */
          numberOfItems: number;
        }
      `,
    },
    // A JSDoc trailing the previous property belongs to that property, not to the next one
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          /** Identifier of the library. */
          libraryId: string; /** trailing note */
          /** Total number of items visible at load time. */
          numberOfItems: number;
        }
      `,
    },
  ],

  invalid: [
    // Variable args to defineFeatureEvents
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const feature = 'dashboard_library';
        const createEvent = defineFeatureEvents('grafana', feature);
      `,
      errors: [{ messageId: 'literalArgsRequired' }],
    },
    // Missing inline comment on an event
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        /** @owner grafana-dashboards */
        export const MyInteractions = {
          loaded: createEvent('loaded'),
        };
      `,
      errors: [{ messageId: 'missingEventComment' }],
    },
    // Interface in an EventProperty file that does not extend EventProperty
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps { numberOfItems: number; }
      `,
      errors: [{ messageId: 'interfaceMustExtend' }],
    },
    // Interface property missing JSDoc in an EventProperty file
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          numberOfItems: number;
        }
      `,
      errors: [{ messageId: 'missingPropertyComment' }],
    },
    // Individually exported event with no description
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'homepage');
        export const homepageViewed = createEvent('viewed');
      `,
      errors: [{ messageId: 'missingEventComment' }],
    },
    // Stacked JSDoc on an event in a grouped object
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        export const MyInteractions = {
          /** Fires when loaded. */
          /** Only once the items are visible. */
          loaded: createEvent('loaded'),
        };
      `,
      errors: [{ messageId: 'stackedJSDocComment' }],
    },
    // Stacked JSDoc on an individually exported event
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'homepage');
        /** Fires once when the homepage first renders. */
        /** Never while a loading skeleton is showing. */
        export const homepageViewed = createEvent('viewed');
      `,
      errors: [{ messageId: 'stackedJSDocComment' }],
    },
    // Stacked JSDoc on an interface property
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          /** Total number of items. */
          /** Counted at load time. */
          numberOfItems: number;
        }
      `,
      errors: [{ messageId: 'stackedJSDocComment' }],
    },
    // Three blocks are reported once, not once per extra block
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          /** One. */
          /** Two. */
          /** Three. */
          numberOfItems: number;
        }
      `,
      errors: [{ messageId: 'stackedJSDocComment' }],
    },
    // Several line comments are still no description, so this is missing rather than stacked
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          // first note
          // second note
          numberOfItems: number;
        }
      `,
      errors: [{ messageId: 'missingPropertyComment' }],
    },
    // A single line comment does not satisfy the requirement either
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          // TODO: document this
          numberOfItems: number;
        }
      `,
      errors: [{ messageId: 'missingPropertyComment' }],
    },
    // A JSDoc trailing the previous property does not document the next one
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          /** Identifier of the library. */
          libraryId: string; /** trailing note */
          numberOfItems: number;
        }
      `,
      errors: [{ messageId: 'missingPropertyComment' }],
    },
  ],
});
