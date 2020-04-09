import { getFilesForManifest, convertSha1SumsToManifest } from './manifest';

describe('Manifest', () => {
  it('should collect file paths', () => {
    const info = getFilesForManifest(__dirname);
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
        "plugin/bundle.managed.ts",
        "plugin/bundle.ts",
        "plugin/create.ts",
        "plugin/tests.ts",
        "plugin.build.ts",
        "plugin.ci.ts",
        "plugin.create.ts",
        "plugin.dev.ts",
        "plugin.tests.ts",
        "plugin.utils.ts",
        "precommit.ts",
        "searchTestDataSetup.ts",
        "task.ts",
        "template.ts",
        "toolkit.build.ts",
      ]
    `);
  });

  it('should convert a sha1 sum to manifest structure', () => {
    const sha1output = `7df059597099bb7dcf25d2a9aedfaf4465f72d8d  LICENSE
4ebed28a02dc029719296aa847bffcea8eb5b9ff  README.md
4493f107eb175b085f020c1afea04614232dc0fd  gfx_sheets_darwin_amd64
d8b05884e3829d1389a9c0e4b79b0aba8c19ca4a  gfx_sheets_linux_amd64
88f33db20182e17c72c2823fe3bed87d8c45b0fd  gfx_sheets_windows_amd64.exe
e6d8f6704dbe85d5f032d4e8ba44ebc5d4a68c43  img/config-page.png
63d79d0e0f9db21ea168324bd4e180d6892b9d2b  img/dashboard.png
7ea6295954b24be55b27320af2074852fb088fa1  img/graph.png
262f2bfddb004c7ce567042e8096f9e033c9b1bd  img/query-editor.png
f134ab85caff88b59ea903c5491c6a08c221622f  img/sheets.svg
40b8c38cea260caed3cdc01d6e3c1eca483ab5c1  module.js
3c04068eb581f73a262a2081f4adca2edbb14edf  module.js.map
bfcae42976f0feca58eed3636655bce51702d3ed  plugin.json`;

    const manifest = convertSha1SumsToManifest(sha1output);

    expect(manifest).toMatchInlineSnapshot(`
      Object {
        "files": Object {
          "LICENSE": "7df059597099bb7dcf25d2a9aedfaf4465f72d8d",
          "README.md": "4ebed28a02dc029719296aa847bffcea8eb5b9ff",
          "gfx_sheets_darwin_amd64": "4493f107eb175b085f020c1afea04614232dc0fd",
          "gfx_sheets_linux_amd64": "d8b05884e3829d1389a9c0e4b79b0aba8c19ca4a",
          "gfx_sheets_windows_amd64.exe": "88f33db20182e17c72c2823fe3bed87d8c45b0fd",
          "img/config-page.png": "e6d8f6704dbe85d5f032d4e8ba44ebc5d4a68c43",
          "img/dashboard.png": "63d79d0e0f9db21ea168324bd4e180d6892b9d2b",
          "img/graph.png": "7ea6295954b24be55b27320af2074852fb088fa1",
          "img/query-editor.png": "262f2bfddb004c7ce567042e8096f9e033c9b1bd",
          "img/sheets.svg": "f134ab85caff88b59ea903c5491c6a08c221622f",
          "module.js": "40b8c38cea260caed3cdc01d6e3c1eca483ab5c1",
          "module.js.map": "3c04068eb581f73a262a2081f4adca2edbb14edf",
          "plugin.json": "bfcae42976f0feca58eed3636655bce51702d3ed",
        },
        "plugin": "<?>",
        "version": "<?>",
      }
    `);
  });
});
