import { RuleTester } from 'eslint';

import rule from '../rules/no-plugin-external-import-paths.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

const ruleTester = new RuleTester();

ruleTester.run('eslint no-plugin-external-import-paths', rule, {
  valid: [
    {
      name: 'external npm package import',
      filename: 'public/app/plugins/panel/histogram/HistogramTooltip.tsx',
      code: "import React from 'react';",
    },
    {
      name: 'grafana package import',
      filename: 'public/app/plugins/panel/histogram/HistogramTooltip.tsx',
      code: "import { Button } from '@grafana/ui';",
    },
    {
      name: 'same plugin file import',
      filename: 'public/app/plugins/panel/histogram/HistogramTooltip.tsx',
      code: "import { someUtil } from './utils';",
    },
    {
      name: 'same plugin subdirectory import',
      filename: 'public/app/plugins/panel/histogram/components/HistogramTooltip.tsx',
      code: "import { Component } from '../Component';",
    },
  ],
  invalid: [
    {
      name: 'sibling plugin import',
      filename: 'public/app/plugins/panel/histogram/HistogramTooltip.tsx',
      code: "import { getDataLinks } from '../status-history/utils';",
      errors: [
        {
          messageId: 'importOutsidePluginBoundaries',
          data: {
            importPath: '../status-history/utils',
            pluginRoot: 'histogram',
          },
        },
      ],
    },
    {
      name: 'grafana core import',
      filename: 'public/app/plugins/panel/histogram/HistogramTooltip.tsx',
      code: "import { something } from '../../../features/dashboard/state';",
      errors: [
        {
          messageId: 'importOutsidePluginBoundaries',
          data: {
            importPath: '../../../features/dashboard/state',
            pluginRoot: 'histogram',
          },
        },
      ],
    },
    {
      name: 'datasource plugin sibling import',
      filename: 'public/app/plugins/datasource/loki/datasource.ts',
      code: "import { something } from '../prometheus/utils';",
      errors: [
        {
          messageId: 'importOutsidePluginBoundaries',
          data: {
            importPath: '../prometheus/utils',
            pluginRoot: 'loki',
          },
        },
      ],
    },
  ],
});
