import { RuleTester } from 'eslint';

import defineFeatureEventsRule from '../rules/define-feature-events.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parser: require('@typescript-eslint/parser'),
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
    // Plain // comment on a grouped-object event should not satisfy the JSDoc requirement
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        export const MyInteractions = {
          // This is a plain line comment, not JSDoc
          loaded: createEvent('loaded'),
        };
      `,
      errors: [{ messageId: 'missingEventComment' }],
    },
    // Plain // comment on an individual export event should not satisfy the JSDoc requirement
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        // This is a plain line comment, not JSDoc
        export const loaded = createEvent('loaded');
      `,
      errors: [{ messageId: 'missingEventComment' }],
    },
    // Non-JSDoc block comment (/* */ without leading *) should not satisfy the JSDoc requirement
    {
      code: `
        ${DEFINE_EVENTS_IMPORT}
        const createEvent = defineFeatureEvents('grafana', 'dashboard_library');
        export const MyInteractions = {
          /* Not a JSDoc comment */
          loaded: createEvent('loaded'),
        };
      `,
      errors: [{ messageId: 'missingEventComment' }],
    },
    // Plain // comment on an interface property should not satisfy the JSDoc requirement
    {
      code: `
        ${EVENT_PROPERTY_IMPORT}
        interface LoadedProps extends EventProperty {
          // This is a plain line comment, not JSDoc
          numberOfItems: number;
        }
      `,
      errors: [{ messageId: 'missingPropertyComment' }],
    },
  ],
});
