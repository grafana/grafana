# Typography

## Classic Typography Principles

### Vertical Rhythm

Your line-height should be the base unit for ALL vertical spacing. If body text has `line-height: 1.5` on `16px` type (= 24px), spacing values should be multiples of 24px. This creates subconscious harmony; text and space share a mathematical foundation.

### Modular Scale & Hierarchy

The common mistake: too many font sizes that are too close together (14px, 15px, 16px, 18px...). This creates muddy hierarchy.

**Use fewer sizes with more contrast.** A 5-size system covers most needs:

| Role | Typical Ratio | Use Case |
|------|---------------|----------|
| xs | 0.75rem | Captions, legal |
| sm | 0.875rem | Secondary UI, metadata |
| base | 1rem | Body text |
| lg | 1.25-1.5rem | Subheadings, lead text |
| xl+ | 2-4rem | Headlines, hero text |

Popular ratios: 1.25 (major third), 1.333 (perfect fourth), 1.5 (perfect fifth). Pick one and commit.

### Readability & Measure

Use `ch` units for character-based measure (`max-width: 65ch`). Line-height scales inversely with line length: narrow columns need tighter leading, wide columns need more.

**Non-obvious**: Light text on dark backgrounds needs compensation on three axes, not just one. Bump line-height by 0.05–0.1, add a touch of letter-spacing (0.01–0.02em), and optionally step the body weight up one notch (regular → medium). The perceived weight drops across all three; fix all three.

**Paragraph rhythm**: Pick either space between paragraphs OR first-line indentation. Never both. Digital usually wants space; editorial/long-form can justify indent-only.

## Font Selection & Pairing

The tactical selection procedure and the reflex-reject list live in [reference/brand.md](brand.md) under **Font selection procedure** and **Reflex-reject list** (loaded for brand-register tasks). The rest of this section covers the adjacent knowledge: anti-reflex corrections, system font use, and pairing rules.

### Anti-reflexes worth defending against

- A technical/utilitarian brief does NOT need a serif "for warmth." Most tech tools should look like tech tools.
- An editorial/premium brief does NOT need the same expressive serif everyone is using right now. Premium can be Swiss-modern, can be neo-grotesque, can be a literal monospace, can be a quiet humanist sans.
- A children's product does NOT need a rounded display font. Kids' books use real type.
- A "modern" brief does NOT need a geometric sans. The most modern thing you can do is not use the font everyone else is using.

**System fonts are underrated**: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui` looks native, loads instantly, and is highly readable. Consider this for apps where performance > personality.

### Pairing Principles

**The non-obvious truth**: You often don't need a second font. One well-chosen font family in multiple weights creates cleaner hierarchy than two competing typefaces. Only add a second font when you need genuine contrast (e.g., display headlines + body serif).

When pairing, contrast on multiple axes:
- Serif + Sans (structure contrast)
- Geometric + Humanist (personality contrast)
- Condensed display + Wide body (proportion contrast)

**Never pair fonts that are similar but not identical** (e.g., two geometric sans-serifs). They create visual tension without clear hierarchy.

### Web Font Loading

The layout shift problem: fonts load late, text reflows, and users see content jump. Here's the fix:

```css
/* 1. Use font-display: swap for visibility */
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: swap;
}

/* 2. Match fallback metrics to minimize shift */
@font-face {
  font-family: 'CustomFont-Fallback';
  src: local('Arial');
  size-adjust: 105%;        /* Scale to match x-height */
  ascent-override: 90%;     /* Match ascender height */
  descent-override: 20%;    /* Match descender depth */
  line-gap-override: 10%;   /* Match line spacing */
}

body {
  font-family: 'CustomFont', 'CustomFont-Fallback', sans-serif;
}
```

Tools like [Fontaine](https://github.com/unjs/fontaine) calculate these overrides automatically.

**`swap` vs `optional`**: `swap` shows fallback text immediately and FOUT-swaps when the web font arrives. `optional` uses the fallback if the web font misses a small load budget (~100ms) and avoids the shift entirely. Pick `optional` when zero layout shift matters more than seeing the branded font on slow networks.

**Preload the critical weight only**: typically the regular-weight body font used above the fold. Preloading every weight costs more bandwidth than it saves.

**Variable fonts for 3+ weights or styles**: a single variable font file is usually smaller than three static weight files, gives fractional weight control, and pairs well with `font-optical-sizing: auto`. For 1–2 weights, static is fine.

## Modern Web Typography

### Fluid Type

Fluid typography via `clamp(min, preferred, max)` scales text smoothly with the viewport. The middle value (e.g., `5vw + 1rem`) controls scaling rate (higher vw = faster scaling). Add a rem offset so it doesn't collapse to 0 on small screens.

**Use fluid type for**: Headings and display text on marketing/content pages where text dominates the layout and needs to breathe across viewport sizes.

**Use fixed `rem` scales for**: App UIs, dashboards, and data-dense interfaces. No major app design system (Material, Polaris, Primer, Carbon) uses fluid type in product UI; fixed scales with optional breakpoint adjustments give the spatial predictability that container-based layouts need. Body text should also be fixed even on marketing pages, since the size difference across viewports is too small to warrant it.

**Bound your clamp()**: keep `max-size ≤ ~2.5 × min-size`. Wider ratios break the browser's zoom and reflow behaviour and make large viewports feel like the page is shouting.

**Scale container width and font-size together** so effective character measure stays in the 45–75ch band at every viewport. A heading that widens faster than its container drifts out of the comfortable measure at the top end.

### OpenType Features

Most developers don't know these exist. Use them for polish:

```css
/* Tabular numbers for data alignment */
.data-table { font-variant-numeric: tabular-nums; }

/* Proper fractions */
.recipe-amount { font-variant-numeric: diagonal-fractions; }

/* Small caps for abbreviations */
abbr { font-variant-caps: all-small-caps; }

/* Disable ligatures in code */
code { font-variant-ligatures: none; }

/* Enable kerning (usually on by default, but be explicit) */
body { font-kerning: normal; }
```

Check what features your font supports at [Wakamai Fondue](https://wakamaifondue.com/).

### Rendering polish

```css
/* Even out heading line lengths (browser picks better break points) */
h1, h2, h3 { text-wrap: balance; }

/* Reduce orphans and ragged endings in long prose */
article p { text-wrap: pretty; }

/* Variable fonts: pick the right optical-size master automatically */
body { font-optical-sizing: auto; }
```

**ALL-CAPS tracking**: capitals sit too close at default spacing. Add 5–12% letter-spacing (`letter-spacing: 0.05em` to `0.12em`) to short all-caps labels, eyebrows, and small headings. Real small caps (via `font-variant-caps`) need the same treatment, slightly gentler.

## Typography System Architecture

Name tokens semantically (`--text-body`, `--text-heading`), not by value (`--font-size-16`). Include font stacks, size scale, weights, line-heights, and letter-spacing in your token system.

## Accessibility Considerations

Beyond contrast ratios (which are well-documented), consider:

- **Never disable zoom**: `user-scalable=no` breaks accessibility. If your layout breaks at 200% zoom, fix the layout.
- **Use rem/em for font sizes**: This respects user browser settings. Never `px` for body text.
- **Minimum 16px body text**: Smaller than this strains eyes and fails WCAG on mobile.
- **Adequate touch targets**: Text links need padding or line-height that creates 44px+ tap targets.

---

**Avoid**: More than 2-3 font families per project. Skipping fallback font definitions. Ignoring font loading performance (FOUT/FOIT). Using decorative fonts for body text.
