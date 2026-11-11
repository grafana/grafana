# Render Markdown with Grafana alerts

Use `MarkdownHTML` to display HTML produced by `renderMarkdown` or `renderTextPanelMarkdown`:

```tsx
import { renderMarkdown } from '@grafana/data';
import { MarkdownHTML } from '@grafana/ui';

<MarkdownHTML className="markdown-html" html={renderMarkdown('> [!NOTE]\n> Read this first.')} />;
```

`MarkdownHTML` sanitizes `html` before inserting it, using Grafana's Markdown sanitizer by default. This preserves task checkboxes and restricts embedded iframes. Use `sanitization="html"` for the HTML sanitizer, which preserves relative links and data attributes but removes inputs and iframes. Keep existing upstream sanitization and URL rewriting. Neither policy allows disabling sanitization; administrator-controlled legacy opt-outs use separate renderers.

The parser recognizes `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION` on the first line of a blockquote. The marker must occupy its own line. Unknown markers, custom titles, escaped markers, and code blocks retain their ordinary Markdown rendering.

The UI uses the actual `Alert` component through React portals, including its theme, icons, and accessibility behavior. NOTE and IMPORTANT use info severity, TIP uses success, WARNING uses warning, and CAUTION uses error. Titles are localized. Alerts are not dismissible.

The string-returning renderers remain compatible with existing consumers. Without `MarkdownHTML`, admonitions appear as readable blockquotes. Consumers outside Grafana's migrated app surfaces, including third-party plugins or separate Markdown engines, must adopt the component to display Alerts.

Core consumers include plugin README/changelog/help, query and transformation help, table Markdown cells, provisioning README, query notices, external user-management information, notebooks, and both Text panel versions. The Text panel editor preview uses the same sandbox rendering path as the panel.

The isolated Text runtime loads a separate React bundle only when admonitions exist. It renders the same component with host theme values and localized titles, and uses bundled SVG icon sources. It does not relax the frame's CSP or sanitizer. Keep sandbox browser tests when changing this integration.
