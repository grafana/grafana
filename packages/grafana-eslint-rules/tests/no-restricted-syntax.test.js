import { RuleTester } from 'eslint';

import noRestrictedSyntax from '../rules/no-restricted-syntax.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parser: require('@typescript-eslint/parser'),
  },
});

const ruleTester = new RuleTester();

const rule = noRestrictedSyntax.rules['no-direct-create-monitoring-logger'];
const zodImportNamespaceRule = noRestrictedSyntax.rules['zod-import-namespace'];
const noSceneDataTransformerRule = noRestrictedSyntax.rules['no-scene-data-transformer'];

const expectedMessage =
  'Direct usage of createMonitoringLogger is not allowed. Register your logger source in packages/grafana-runtime/src/services/logging/loggers.ts and use getLogger from @grafana/runtime/unstable instead.';
const expectedZodImportMessage =
  "Zod imports must use exactly `import * as z from 'zod'` or `import type * as z from 'zod'`. Imports from zod subpaths are not allowed.";
const expectedSceneDataTransformerMessage =
  "Build a panel's data transformer with createPanelDataTransformer from app/features/dashboard-scene/utils/createPanelDataTransformer. Constructing SceneDataTransformer directly omits PanelPluginTransformationsBehaviour, so the panel renders untransformed data with no error to notice.";

ruleTester.run('no-direct-create-monitoring-logger', rule, {
  valid: [
    {
      name: 'getLogger from @grafana/runtime/unstable',
      code: `import { getLogger } from '@grafana/runtime/unstable';`,
    },
    {
      name: 'other named imports from @grafana/runtime',
      code: `import { config, type MonitoringLogger } from '@grafana/runtime';`,
    },
    {
      name: 'createMonitoringLogger imported from a relative path (registry use)',
      code: `import { createMonitoringLogger } from '../../utils/logging';`,
    },
  ],
  invalid: [
    {
      name: 'createMonitoringLogger imported from @grafana/runtime',
      code: `import { createMonitoringLogger } from '@grafana/runtime';`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'aliased createMonitoringLogger import from @grafana/runtime',
      code: `import { createMonitoringLogger as cml } from '@grafana/runtime';`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'createMonitoringLogger alongside other imports — only one error',
      code: `import { config, createMonitoringLogger, type MonitoringLogger } from '@grafana/runtime';`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'runtime import from @grafana/runtime',
      code: `import runtime from '@grafana/runtime'; const logger = runtime.createMonitoringLogger('my-logger');`,
      errors: [{ message: expectedMessage }],
    },
    {
      name: 'runtime star import from @grafana/runtime',
      code: `import * as runtime from '@grafana/runtime'; const logger = runtime.createMonitoringLogger('my-logger');`,
      errors: [{ message: expectedMessage }],
    },
  ],
});

ruleTester.run('zod-import-namespace', zodImportNamespaceRule, {
  valid: [
    {
      name: 'value namespace import named z',
      code: "import * as z from 'zod';",
    },
    {
      name: 'type namespace import named z',
      code: "import type * as z from 'zod';",
    },
    {
      name: 'non-zod imports are ignored',
      code: "import { z } from 'other-lib';",
    },
  ],
  invalid: [
    {
      name: 'named import is disallowed',
      code: "import { z } from 'zod';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'default import is disallowed',
      code: "import z from 'zod';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'namespace alias different from z is disallowed',
      code: "import * as zod from 'zod';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'type named import is disallowed',
      code: "import type { ZodType } from 'zod';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'mixed specifiers are disallowed',
      code: "import z, * as zns from 'zod';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'side effect import is disallowed',
      code: "import 'zod';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'namespace import from zod subpath is disallowed',
      code: "import * as z from 'zod/mini';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'named import from zod subpath is disallowed',
      code: "import { z } from 'zod/mini';",
      errors: [{ message: expectedZodImportMessage }],
    },
    {
      name: 'namespace alias from zod subpath different from z is disallowed',
      code: "import * as zod from 'zod/v4';",
      errors: [{ message: expectedZodImportMessage }],
    },
  ],
});

ruleTester.run('no-scene-data-transformer', noSceneDataTransformerRule, {
  valid: [
    {
      name: 'the factory is the sanctioned construction path',
      code: `const $data = createPanelDataTransformer({ $data: queryRunner, transformations });`,
    },
    {
      name: 'importing the type is fine',
      code: `import { type SceneDataTransformerState } from '@grafana/scenes';`,
    },
    {
      name: 'reading an existing transformer is fine',
      code: `const transformations = panel.state.$data.state.transformations;`,
    },
    {
      name: 'other scenes constructors are untouched',
      code: `const $data = new SceneQueryRunner({ queries });`,
    },
    {
      name: 'calling it without new is not a construction site',
      code: `const isTransformer = (obj) => obj instanceof SceneDataTransformer;`,
    },
  ],
  invalid: [
    {
      name: 'direct construction',
      code: `const $data = new SceneDataTransformer({ $data: queryRunner, transformations });`,
      errors: [{ message: expectedSceneDataTransformerMessage }],
    },
    {
      name: 'construction with no arguments',
      code: `const $data = new SceneDataTransformer();`,
      errors: [{ message: expectedSceneDataTransformerMessage }],
    },
    {
      name: 'construction through a namespace import',
      code: `import * as scenes from '@grafana/scenes'; const $data = new scenes.SceneDataTransformer({});`,
      errors: [{ message: expectedSceneDataTransformerMessage }],
    },
    {
      name: 'construction even when $behaviors is passed by hand',
      code: `const $data = new SceneDataTransformer({ transformations, $behaviors: [new PanelPluginTransformationsBehaviour()] });`,
      errors: [{ message: expectedSceneDataTransformerMessage }],
    },
    {
      name: 'each construction site is reported',
      code: `const a = new SceneDataTransformer({}); const b = new SceneDataTransformer({});`,
      errors: [{ message: expectedSceneDataTransformerMessage }, { message: expectedSceneDataTransformerMessage }],
    },
  ],
});
