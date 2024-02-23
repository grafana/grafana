import { readFileSync } from 'fs';
import { resolve } from 'path';

import { completeTemplate } from './generate-transformations.ts';

describe('makefile script tests', () => {
  it('should execute without error and match the content written to index.md', () => {
    // Build root directory path.
    const rootDir = resolve(__dirname, '../../');

    // Build path to the generated markdown file.
    const path = resolve(rootDir, 'docs/sources/panels-visualizations/query-transform-data/transform-data/index.md');

    // Read the content of the generated markdown file.
    const markdownContent = readFileSync(path, 'utf-8');

    // Normalize the content of the generated markdown file and the content of the JS template and compare.
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
