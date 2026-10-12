import { type CSSProperties, type ReactNode } from 'react';

// A plain semantic list (ul/li) rather than a styled component: @grafana/ui's own List is
// deprecated in favour of exactly this ("use ul/li/arr.map directly instead"). The reset
// below only removes the browser's default bullet/indent - there is no primitive for that,
// so a plain inline style is simpler here than a useStyles2 hook for two static properties.
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

/**
 * Wraps a page's folder or rule rows in a real `<ul>` so screen readers report the group as a
 * list with a size, rather than an unordered run of divs. Each row must still be wrapped in
 * `<li>` by the caller (`RuleListItem` renders its own) - this only owns the `<ul>` itself.
 */
export function RuleRowList({ children }: { children: ReactNode }) {
  return <ul style={listStyle}>{children}</ul>;
}
