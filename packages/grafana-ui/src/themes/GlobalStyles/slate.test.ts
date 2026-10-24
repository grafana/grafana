import { getThemeById } from '@grafana/data';

import { getSlateStyles } from './slate';

describe('getSlateStyles', () => {
  it('wraps query-preview .prism-syntax-highlight without forcing wrap on log-line .field', () => {
    const { styles } = getSlateStyles(getThemeById('dark'));

    // Token colors stay shared with log lines that opt into the class for custom grammars.
    expect(styles).toContain('.prism-syntax-highlight');
    expect(styles).toContain('.token.comment');

    // Layout wrap is scoped away from `.field` so wrap-disabled log lines keep white-space: pre.
    expect(styles).toContain('.prism-syntax-highlight:not(.field)');
    expect(styles).toMatch(/\.prism-syntax-highlight:not\(\.field\)\{[^}]*white-space:pre-wrap/);
    expect(styles).toMatch(/\.prism-syntax-highlight:not\(\.field\)\{[^}]*word-break:break-all/);
    expect(styles).not.toMatch(/(?<!:not\(\.field\))\.prism-syntax-highlight\{[^}]*white-space:pre-wrap/);
  });
});
