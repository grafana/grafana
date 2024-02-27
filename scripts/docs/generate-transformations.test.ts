import { getMarkdownContent, getJavaScriptContent, readMeContent } from './generate-transformations.ts';

describe('makefile script tests', () => {
  it('should execute without error and match the content written to index.md', () => {
    // Normalize and compare.
    expect(contentDoesMatch(getJavaScriptContent(), getMarkdownContent())).toBe(true);
  });

  it('should be able to tell if the content DOES NOT match', () => {
    const wrongContent = getJavaScriptContent().concat('additional content to mismatch');
    // Normalize and compare.
    expect(contentDoesMatch(wrongContent, getMarkdownContent())).toBe(false);

    // If this test fails, refer to `./docs/README.md` "Content guidelines" for more information
    // about editing and building the Transformations docs.
  });
});

export function contentDoesMatch(jsContent: string, mdContent: string): Boolean {
  return normalizeContent(jsContent) === normalizeContent(mdContent);
}

/* 
  Normalize content by removing all whitespace (spaces, tabs, newlines, carriage returns, 
  form feeds, and vertical tabs) and special characters.

  NOTE: There are numerous unpredictable formatting oddities when transforming JavaScript to Markdown;
  almost all of them are irrelevant to the actual content of the file, which is why we strip them out here.

  For example:

  In JavaScript, the following string table

  | A | B | C |
  | - | - | - |
  | 1 | 3 | 5 |
  | 2 | 4 | 6 |
  | 3 | 5 | 7 |
  | 4 | 6 | 8 |
  | 5 | 7 | 9 |

  parses to Markdown as

  | A   | B   | C   |
  | --- | --- | --- | <--------- notice the extra hyphens
  | 1   | 3   | 5   | <--------- notice the extra spaces
  | 2   | 4   | 6   |
  | 3   | 5   | 7   |
  | 4   | 6   | 8   |
  | 5   | 7   | 9   |

  This is one of many arbitrary formatting anomalies that we can ignore by normalizing the 
  content before comparing the JavaScript template literals and the final Markdown.
*/
function normalizeContent(content: string): string {
  return content.replace(/\s+|[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '').trim();
}
