# Adding CodeMirror language support

`CodeMirrorEditor` loads language extensions on demand through `languageLoader.ts`. Keep language loading centralized there so every consumer gets the same behavior without adding a language package to the initial editor bundle.

## Add a language

The examples below add Python support. Replace all Python references with the language you are adding.

1. Add the CodeMirror language package to `@grafana/ui` from the repository root:

   ```bash
   yarn workspace @grafana/ui add @codemirror/lang-python
   ```

   Commit the resulting changes to `packages/grafana-ui/package.json` and `yarn.lock`.

2. Add the public language name to `CodeMirrorEditorLanguage` in `types.ts`:

   ```ts
   export type CodeMirrorEditorLanguage = 'json' | 'python' | 'sql';
   ```

3. Add an asynchronous loader in `languageLoader.ts`. Give the import a stable chunk name and return the extension created by the language package:

   ```ts
   const loadPython = async (): Promise<CodeMirrorExtension> =>
     (await import(/* webpackChunkName: "codemirror-lang-python" */ '@codemirror/lang-python')).python();
   ```

4. Register the loader in `resolveLoad`:

   ```ts
   case 'python':
     return { cacheKey: 'python', load: loadPython };
   ```

   The cache key must identify the resulting extension. If a language has configuration that changes the extension, include that configuration in the cache key, as the SQL dialect loader does. Thread new configuration through `CodeMirrorEditorProps`, `useLanguageExtension`, and `LoadLanguageOptions` rather than importing the language directly in a consumer.

5. Add the language to `languageOptions` in `CodeEditor.story.tsx` so it can be selected in Storybook, and add focused coverage to `languageLoader.test.ts`.

## Verify the change

Run the shared editor tests and formatting checks from the repository root:

```bash
yarn jest --no-watch packages/grafana-ui/src/components/CodeMirror/languageLoader.test.ts packages/grafana-ui/src/components/CodeMirror/CodeEditor.test.tsx
yarn prettier --check packages/grafana-ui/src/components/CodeMirror/ADDING_LANGUAGES.md
```

Use the CodeMirrorEditor Storybook story to confirm syntax highlighting and any language-specific behavior in the browser.
