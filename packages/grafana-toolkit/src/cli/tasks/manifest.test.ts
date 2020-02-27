import { getFilePaths } from './manifest';

describe('Manifest', () => {
  it('should collect file paths', () => {
    const info = getFilePaths(__dirname);
    expect(info).toMatchInlineSnapshot(`
      Array [
        "changelog.ts",
        "cherrypick.ts",
        "closeMilestone.ts",
        "core.start.ts",
        "manifest.test.ts",
        "manifest.ts",
        "nodeVersionChecker.ts",
        "package.build.ts",
        "plugin/bundle.ts",
        "plugin/create.ts",
        "plugin/tests.ts",
        "plugin.build.ts",
        "plugin.ci.ts",
        "plugin.create.ts",
        "plugin.dev.ts",
        "plugin.tests.ts",
        "precommit.ts",
        "searchTestDataSetup.ts",
        "task.ts",
        "template.ts",
        "toolkit.build.ts",
      ]
    `);
  });
});
