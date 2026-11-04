import { type AriaAttributes, type CSSProperties, type ReactNode } from 'react';

// Plain ul/li since @grafana/ui's List is deprecated; the inline style only resets bullet/indent.
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

interface RuleRowListProps extends AriaAttributes {
  children: ReactNode;
}

/** A real `<ul>` so screen readers announce a list; callers wrap each row in `<li>`. */
export function RuleRowList({ children, ...ariaAttributes }: RuleRowListProps) {
  return (
    <ul style={listStyle} {...ariaAttributes}>
      {children}
    </ul>
  );
}
