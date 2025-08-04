import { BettererFileTest } from '@betterer/betterer';
import { promises as fs } from 'fs';

// Avoid using functions that report the position of the issues, as this causes a lot of merge conflicts
export default {
  'no undocumented stories': () => countUndocumentedStories().include('**/!(*.internal).story.tsx'),
  'no skipping a11y tests in stories': () => countSkippedA11yTestStories().include('**/*.story.tsx'),
  'no gf-form usage': () =>
    regexp(/gf-form/gm, 'gf-form usage has been deprecated. Use a component from @grafana/ui or custom CSS instead.')
      .include('**/*.{ts,tsx,html}')
      .exclude(new RegExp('packages/grafana-ui/src/themes/GlobalStyles')),
};

function countSkippedA11yTestStories() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    await Promise.all(
      filePaths.map(async (filePath) => {
        // look for skipped a11y tests
        const skipRegex = new RegExp("a11y: { test: 'off' }", 'gm');

        const fileText = await fs.readFile(filePath, 'utf8');

        const hasSkip = skipRegex.test(fileText);
        if (hasSkip) {
          // In this case the file contents don't matter:
          const file = fileTestResult.addFile(filePath, '');
          // Add the issue to the first character of the file:
          file.addIssue(0, 0, 'No skipping of a11y tests in stories. Please fix the component or story instead.');
        }
      })
    );
  });
}

function countUndocumentedStories() {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    await Promise.all(
      filePaths.map(async (filePath) => {
        // look for .mdx import in the story file
        const mdxImportRegex = new RegExp("^import.*\\.mdx';$", 'gm');
        // Looks for the "autodocs" string in the file
        const autodocsStringRegex = /autodocs/;

        const fileText = await fs.readFile(filePath, 'utf8');

        const hasMdxImport = mdxImportRegex.test(fileText);
        const hasAutodocsString = autodocsStringRegex.test(fileText);
        // If both .mdx import and autodocs string are missing, add an issue
        if (!hasMdxImport && !hasAutodocsString) {
          // In this case the file contents don't matter:
          const file = fileTestResult.addFile(filePath, '');
          // Add the issue to the first character of the file:
          file.addIssue(0, 0, 'No undocumented stories are allowed, please add an .mdx file with some documentation');
        }
      })
    );
  });
}

/**
 *  Generic regexp pattern matcher, similar to @betterer/regexp.
 *  The only difference is that the positions of the errors are not reported, as this may cause a lot of merge conflicts.
 */
function regexp(pattern: RegExp, issueMessage: string) {
  return new BettererFileTest(async (filePaths, fileTestResult) => {
    await Promise.all(
      filePaths.map(async (filePath) => {
        const fileText = await fs.readFile(filePath, 'utf8');
        const matches = fileText.match(pattern);
        if (matches) {
          // File contents doesn't matter, since we're not reporting the position
          const file = fileTestResult.addFile(filePath, '');
          matches.forEach(() => {
            file.addIssue(0, 0, issueMessage);
          });
        }
      })
    );
  });
}
