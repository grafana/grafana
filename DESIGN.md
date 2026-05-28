# Design

## Theme

Dark by default — an SRE at 2am on a 27-inch monitor in a dim NOC room. Dark surfaces reduce glare and let chart colours read clearly without competing with background brightness. Light mode is a first-class alternative for daytime use. Both modes use the same token system; only the concrete palette values change.

## Color

### Strategy

Restrained: ink/neutral tinted neutrals carry the chrome. Orange (Grafana brand) is the single accent, used at ≤10% of any surface. Semantic hues (coral, sage, amber, sky) carry meaning only — error, success, warning, info.

### Ink scale — dark mode structural colours (OKLCH hue ~255, blue-tinted)

| Step | Value |
|---|---|
| ink-50 | `oklch(0.95 0.006 255)` |
| ink-100 | `oklch(0.9 0.008 255)` |
| ink-200 | `oklch(0.8 0.012 255)` |
| ink-300 | `oklch(0.68 0.016 255)` |
| ink-400 | `oklch(0.55 0.018 255)` |
| ink-500 | `oklch(0.44 0.016 255)` |
| ink-600 | `oklch(0.34 0.014 255)` |
| ink-700 | `oklch(0.25 0.012 255)` |
| ink-800 | `oklch(0.2 0.01 255)` |
| ink-900 | `oklch(0.16 0.009 255)` |
| ink-950 | `oklch(0.12 0.008 255)` |

Dark mode surface mapping: surface=ink-900, surface-raised=ink-800, surface-sunken=ink-950, border=ink-700, border-subtle=ink-800.

### Neutral scale — light mode structural colours (warm greys)

| Step | Value |
|---|---|
| neutral-50 | `#fafafa` |
| neutral-100 | `#f5f5f4` |
| neutral-200 | `#ebebea` |
| neutral-300 | `#dddcdb` |
| neutral-400 | `#b0afae` |
| neutral-500 | `#878685` |
| neutral-600 | `#6b6a69` |
| neutral-700 | `#4d4c4b` |
| neutral-800 | `#2c2b2a` |
| neutral-900 | `#1c1b1a` |
| neutral-950 | `#121111` |

### Orange — brand accent

`#ed7d2d` (500). Scale: 50 `#fff7ed` → 900 `#743218`. Used for: primary CTA fills, active tab underlines, selected nav stripes, focus rings, edit-mode canvas background.

### Semantic hues (OKLCH, low chroma)

| Role | Hue | Usage |
|---|---|---|
| coral | 25 | error, critical |
| amber | 85 | warning, pending |
| sage | 160 | success, healthy |
| sky | 230 | info |
| teal | 185 | categorisation |
| blue | 260 | categorisation |
| violet | 290 | categorisation |
| lavender | 310 | categorisation |
| rose | 350 | categorisation |
| lime | 130 | categorisation |
| peach | 55 | categorisation |

All semantic hues follow the same low-chroma OKLCH pattern: chroma stays ≤0.17, drops below 0.1 at the extremes.

### Abstract semantic tokens

```
surface              = neutral-50 / ink-900 (dark)
surface-raised       = neutral-100 / ink-800 (dark)
surface-sunken       = neutral-100 / ink-950 (dark)
border               = neutral-200 / ink-700 (dark)
border-subtle        = neutral-100 / ink-800 (dark)
text-primary         = neutral-900 / ink-50 (dark)
text-secondary       = neutral-600 / ink-300 (dark)
text-tertiary        = neutral-400 / ink-500 (dark)
accent               = orange-500 / orange-400 (dark)
accent-subtle        = orange-50 / orange-900 (dark)
success              = sage-600
error                = coral-500
warning              = amber-500
```

## Typography

**Font**: Geist Variable (sans-serif). Monospace for code: ui-monospace, "SF Mono", Consolas.

Anti-aliasing: `-webkit-font-smoothing: antialiased`.

Scale used in dashboard chrome:
- `text-[11px]` — metadata labels, timestamps
- `text-[12px]` — control labels, variable pills, menu items, sidebar content
- `text-[13px]` — panel titles, section headers, sidebar headings, body text
- `text-[14px]` — breadcrumb items, nav labels

Weight rhythm: 400 body → 500 medium labels → 600 semibold headings.

## Elevation & Shadows

Composable shadow system. Light mode: shadow-only outlines (no border property). Dark mode: real border (`inset-ring`) for extra contrast.

```
shadow-outline          = 0 0 0 1px rgba(0,0,0,0.08)
shadow-xs               = 0 1px 1px -0.5px rgba(0,0,0,0.04)
shadow-sm               = outline + xs + 0 2px 2px -1px
shadow-md               = sm + 0 4px 4px -2px
shadow-lg               = md + 0 8px 8px -4px
shadow-xl               = lg + 0 16px 16px -8px
shadow-outline-sm       = outline + sm
shadow-outline-md       = outline + md
```

In dark mode add: `inset-ring inset-ring-ink-600/30` to card-like surfaces.

## Border Radius

```
radius-sm   = 6px   (chips, small badges, drag handles)
radius-md   = 8px   (inputs, buttons, dropdowns, popovers — default)
radius-lg   = 12px  (panels, cards, notification toasts)
radius-full = 9999px (pills, avatars)
```

Dashboard panel cards use `radius-lg` (12px). Controls bar elements use `radius-md`.

## Layout

### Two modes, explicitly chosen

1. **Edge-to-edge**: dashboards, visualisations, query builders. Width is a resource these surfaces spend.
2. **Centred 1100px column**: settings, lists, forms, profile pages.

### App shell

- Left sidebar: 44px icon column + optional 200px expanded sub-nav. Background: `surface-sunken`. Separates from main content with `border-l border-border-subtle`.
- Top header bar: 40px. Contains: sidebar toggle, breadcrumbs, search ⌘K, help, notifications, assistant toggle.
- Dashboard right icon column: 40px. Background: `surface`. Contains: export, outline, insights icons (persistent) + add/settings/code icons in edit mode.

### Dashboard chrome

Controls bar height: 37px. Contains: scopes toggle, variable pills (compact summary → expand to sheet), time picker, refresh picker, save/edit buttons. Sticky at top.

### Edit mode visual

When editing: canvas background becomes `accent-500 / accent-400`. A 24px orange strip appears at the top with a centred "Editing" label (white, 13px, semibold). Edit-mode icons animate into the right icon column above a divider. Right sidebar panel (settings/export/outline) slides in from the right (340px default, resizable 220–560px).

## Components

### Variables strip

Read-only pill summary in the controls bar. Click opens an animated sheet that expands downward over the canvas. Pinned variables appear first. Each row: fixed 140px label column + value editor (chips, dropdown, or textbox). Hover linking: hovering a sheet chip highlights the matching bar pill in orange.

Pill states:
- Selected chip: `bg-neutral-200 / ink-700` text `neutral-900 / ink-100`
- Unselected chip: `bg-neutral-100/60 / ink-800/50` text `neutral-400 / ink-500`
- Chip hover: `bg-orange-500/10` text `orange-600 / orange-400`
- Active variable label in bar: `bg-orange-500/10` text `orange-600 / orange-400`

### Buttons

Primary (default): `bg-neutral-900 text-white dark:bg-ink-100 dark:text-ink-900`. Hover: `bg-neutral-800 / ink-200`.

Secondary: `bg-surface border border-border shadow-outline-sm`. Hover: `bg-surface-raised`.

Ghost: no background, text `text-secondary`. Hover: `bg-surface-raised text-primary`.

All buttons: `h-7` (28px) for dashboard chrome, `h-8` (32px) for form contexts. `gap-1.5 px-2.5`. `text-[12px]`. `rounded-md` (8px). `cursor-pointer`.

### Sidebar panel (right)

Slides in with `transform: translateX(panelWidth → 0)`, ease `[0.32, 0.72, 0, 1]` duration 260ms. On exit: `absolute` position so canvas reflows behind the panel while it's still visible. Background: `surface`. `border-l border-border-subtle`. Contains a close (×) button at 20px, a 13px semibold title, a border-b divider, then scrollable content.

### Dashboard panel frame

`CardContainer` wraps: panel header row (label left, assistant sparkle + ⋯ menu right, both hidden until panel hover), then an inner `Card` with `shadow-outline-sm` and `rounded-lg`. Panel title: `text-[12px] font-medium text-secondary`. Hover: `text-primary bg-neutral-200/70 / ink-700/55`.

Edit mode ring on selected panel: `0 0 0 1px accent-500, 0 0 0 5px accent-500/15%.`

### Focus ring

`outline: none` on focus-visible. Ring: `0 0 0 1px accent + 0 0 0 4px accent/20%`.

## Motion

All transitions are brief. Exponential ease-out (no bounce, no elastic).

| Pattern | Duration | Easing |
|---|---|---|
| Expand/collapse (variables sheet, sidebar sections) | 220ms | `[0.4, 0, 0.2, 1]` |
| Sidebar panel slide (in/out) | 260ms | `[0.32, 0.72, 0, 1]` |
| Spring layout shift (edit mode canvas, save button arrival) | spring stiffness 380 damping 36 | — |
| Fade in (overlays, toasts) | 150ms | `easeOut` |
| Icon nav sub-panel expand | 120ms | `easeInOut` |

Never animate layout CSS properties (width, height during reflow) on the main content. Prefer `transform` and `opacity`.

## Absolute bans

- Side-stripe borders (`border-left > 1px` as coloured accent). Replace with background tints or full borders.
- Gradient text (`background-clip: text`). Use a solid colour.
- Accent on hover backgrounds. Hover stays neutral; accent is reserved for selected/active states.
- Nested cards.
- Same padding everywhere (vary for rhythm).
