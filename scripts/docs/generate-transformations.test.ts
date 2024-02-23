import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { completeTemplate } from './generate-transformations.ts';

describe('Makefile Tests', () => {
  const rootDir = resolve(__dirname, '../../');
  const makefilePath = resolve(rootDir, 'docs/Makefile');

  it('should execute makefile without error', () => {
    const output = execSync(
      `make -C ${rootDir}/docs -f ${makefilePath} sources/panels-visualizations/query-transform-data/transform-data/index.md`
    );

    // Check that the output does not contain any error messages
    expect(output.toString()).not.toMatch(/error/i);
  });

  it('should match the content written to index.md', () => {
    const path = resolve(rootDir, 'docs/sources/panels-visualizations/query-transform-data/transform-data/index.md');
    const markdownContent = readFileSync(path, 'utf-8');

    expect(normalizeContent(markdownContent)).toEqual(normalizeContent(completeTemplate));
  });
});

/* 
  Normalize content by removing all whitespace (spaces, tabs, newlines, carriage returns, 
  form feeds, and vertical tabs) and special characters.

  NOTE: There are numerous unpredictable formatting oddities when pasring javascript to markdown;
  almost all of them are irrelevant to the actual content of the file, which is why we strip them out here.

  For example:

  In JavaScript, the following string table

  | Temp  | Uptime    |
  | ----- | --------- |
  | 15.4  | 1230233   |

  parses to Markdown as

  | Temp | Uptime  |
  | ---- | ------- | <--------- notice that there are fewer hyphens
  | 15.4 | 1230233 |

  This is one of many arbitrary formatting anomalies that we can ignore by normalizing the content.
*/
function normalizeContent(content: string): string {
  return content.replace(/\s+|[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '').trim();
}
