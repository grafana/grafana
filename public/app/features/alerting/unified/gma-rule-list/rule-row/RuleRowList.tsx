import { type CSSProperties, type ReactNode } from 'react';

// Plain ul/li since @grafana/ui's List is deprecated; the inline style only resets bullet/indent.
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

/** A real `<ul>` so screen readers announce a list; callers wrap each row in `<li>`. */
export function RuleRowList({ children }: { children: ReactNode }) {
  return <ul style={listStyle}>{children}</ul>;
}
