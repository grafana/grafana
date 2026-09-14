# new cmdk

A new architecture that should replace the current command palette and the kbar library we use underneath.

## Architecture

It should contain a list of CmdkSources. Each CmdkSource is dynamically registerable with the newCmdk. newCmdk will keep a list of CmdkSources.

Sources are registered through a new plugin extension type, usable both by plugins and by core Grafana code. The current command palette extension links stay as they are; later we can create a built-in source that provides them.

Each CmdkSource will be queried with the current query string. At the start, the query will also run with empty query to allow for CmdkSources that add static items, like navigation sections.

Filtering happens only inside the source — each source decides whether to filter on the frontend or the backend. newCmdk does not filter, it only sorts. Debouncing is also handled internally by each source (the abortSignal makes this safe).

The query function will return a promise with items. While the promise is not resolved the section defined by the providedSections, can show separate loading status. Having the providedSections also means we can show the sections beforehand. To prevent flicker, old results are kept visible until the new ones arrive. For now query errors are ignored and treated as no results. Each query function will also take an abortSignal to allow the CmdkSources to cancel the query when signalled (on query change or on cmdk closing).

The results from the query of each source will be then grouped by their section and rendered in a single list. Some known sections have hardcoded ordering; otherwise sections are ordered by registration order for now. Sections with no results are hidden, though a section stays visible with a loading indicator while its source is still loading.

The UI is a split view: results list on the left, detail of the focused item (renderDetail) on the right — similar to how the current command palette works with deep search.

Each area of the current command palette (static/nav actions, recent dashboards, dashboard search, scopes, extension links, deep search) should get its own source, and the architecture must be good enough for each to reach parity — except deep search results will be inlined in the list instead of a separate column.

### types:

```typescript
import { ReactNode } from 'react';

interface CmdkSource {
  query(query: string, abortSignal: AbortSignal): Promise<CmdkItem[]>;

  // The sections provided do not have to be unique. That way multiple sources can for example provide dashboard items in dashboards section.
  providedSections: CmdkSection[];

  // Used in subscope stack to show it to the user in the input field.
  subscopeName?: string;

  // Rendered as a row under the search input while the palette is open (only for registered sources, not for
  // sources living in the subscope stack, so the row stays mounted while the user dives into subscopes). Used
  // for example by scopes to show the current selection with an apply button. Return null when there is nothing
  // to show. The refresh callback re-queries the active sources, for when the header mutates state the items
  // depend on.
  renderHeader?: (context: { refresh: () => void }) => ReactNode;
}

type CmdkSection = {
  title: string;
  id: string;
};

// The behavior part shared by items and additional actions: what happens when they are triggered.
interface CmdkActionBehavior {
  type: 'action';

  // Executed when triggered.
  action: () => void;

  // When true the palette stays open after the action runs and the active sources are re-queried. Used for
  // multi-select style actions (like selecting scopes) that change what the sources will return.
  keepOpen?: boolean;
}

interface CmdkNavigationBehavior {
  type: 'navigation';

  // Navigates to the href when triggered.
  href: string;
  // Optional link target, e.g. '_blank' to open in a new tab.
  target?: LinkTarget;
}

interface CmdkSubscopeBehavior {
  type: 'subscope';

  // Pushes the returned source onto the subscope stack when triggered, allowing for faceted UI in the cmdk.
  getScope: () => CmdkSource;
}

type CmdkItem = CmdkItemBase & (CmdkActionBehavior | CmdkNavigationBehavior | CmdkSubscopeBehavior);

interface CmdkItemBase {
  // Unique id, used for React keys, focus tracking across re-queries and deduping.
  id: string;
  // Source can return items with different sections.
  sectionId: string;
  title: string;
  // The final sort will be done in the cmdk but this should aid that sort.
  priority: number;

  // smaller text pinned to the right edge of the line
  rightSubtitle?: string;

  // list of tags, for example dashboard tags when showing a dashboard
  tags?: string[];
  // a smaller text shown next to the title, usually used for parent folder
  subtitle?: string;
  // additional small text items that will be displayed next to the subtitle in single line.
  subtitleItems?: string[];

  // actions that can be performed on the item. The will be shown as pills on the right edge of the item. These will be executed if the shortcut is pressed when focus is on the item.
  additionalActions?: CmdkAction[];

  // A component that will be rendered as a detail of the item in the right hand side of the split view when the item is focused.
  renderDetail?: () => ReactNode;
}

interface CmdkActionBase {
  title: string;
  shortcut: string;
}

// Additional actions on an item, shown as pills. Triggered when the pill is clicked or the shortcut is pressed
// while the owning item is focused. The subscope behavior lets an item both navigate on select and offer diving
// into its children, e.g. a nav item with subpages.
type CmdkAction = CmdkActionBase & (CmdkActionBehavior | CmdkSubscopeBehavior);
```

### scoping

Each item can also create a subscope for the cmdk. The subscopes are defined by a stack of sources. Only the last source in the stack will be queried. Source is pushed in the stack when a CmdkItemSubscope is selected. This will clear the input and add the subscopeName to the input as a pill in front of the input cursor to show the scope to the user. With multiple subscopes this should create a sort of breadcrumb in front of the input.

Hitting backspace with an empty input but non empty subscope stack will pop the last item from the stack.
