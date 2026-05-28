> **Additional context needed**: existing brand colors.

Replace timid grayscale or single-accent designs with a strategic palette: pick a color strategy, choose a hue family that fits the brand, then apply color with intent. More color ≠ better. Strategic color beats rainbow vomit.

---

## Register

Brand: palette IS voice. Pick a color strategy first per SKILL.md (Restrained / Committed / Full palette / Drenched) and follow its dosage. Committed, Full palette, and Drenched deliberately exceed the ≤10% rule; that rule is Restrained only. Unexpected combinations are allowed; a dominant color can own the page when the chosen strategy calls for it.

Product: semantic-first and almost always Restrained. Accent color is reserved for primary action, current selection, and state indicators. Not decoration. Every color has a consistent meaning across every screen.

---

## Assess Color Opportunity

Analyze the current state and identify opportunities:

1. **Understand current state**:
   - **Color absence**: Pure grayscale? Limited neutrals? One timid accent?
   - **Missed opportunities**: Where could color add meaning, hierarchy, or delight?
   - **Context**: What's appropriate for this domain and audience?
   - **Brand**: Are there existing brand colors we should use?

2. **Identify where color adds value**:
   - **Semantic meaning**: Success (green), error (red), warning (yellow/orange), info (blue)
   - **Hierarchy**: Drawing attention to important elements
   - **Categorization**: Different sections, types, or states
   - **Emotional tone**: Warmth, energy, trust, creativity
   - **Wayfinding**: Helping users navigate and understand structure
   - **Delight**: Moments of visual interest and personality

If any of these are unclear from the codebase, {{ask_instruction}}

**CRITICAL**: More color ≠ better. Strategic color beats rainbow vomit every time. Every color should have a purpose.

## Plan Color Strategy

Create a purposeful color introduction plan:

- **Color palette**: What colors match the brand/context? (Choose 2-4 colors max beyond neutrals)
- **Dominant color**: Which color owns 60% of colored elements?
- **Accent colors**: Which colors provide contrast and highlights? (30% and 10%)
- **Application strategy**: Where does each color appear and why?

**IMPORTANT**: Color should enhance hierarchy and meaning, not create chaos. Less is more when it matters more.

## Introduce Color Strategically

Add color systematically across these dimensions:

### Semantic Color
- **State indicators**:
  - Success: Green tones (emerald, forest, mint)
  - Error: Red/pink tones (rose, crimson, coral)
  - Warning: Orange/amber tones
  - Info: Blue tones (sky, ocean, indigo)
  - Neutral: Gray/slate for inactive states

- **Status badges**: Colored backgrounds or borders for states (active, pending, completed, etc.)
- **Progress indicators**: Colored bars, rings, or charts showing completion or health

### Accent Color Application
- **Primary actions**: Color the most important buttons/CTAs
- **Links**: Add color to clickable text (maintain accessibility)
- **Icons**: Colorize key icons for recognition and personality
- **Headers/titles**: Add color to section headers or key labels
- **Hover states**: Introduce color on interaction

### Background & Surfaces
- **Tinted backgrounds**: Replace pure gray (`#f5f5f5`) with warm neutrals (`oklch(97% 0.01 60)`) or cool tints (`oklch(97% 0.01 250)`)
- **Colored sections**: Use subtle background colors to separate areas
- **Gradient backgrounds**: Add depth with subtle, intentional gradients (not generic purple-blue)
- **Cards & surfaces**: Tint cards or surfaces slightly for warmth

**Use OKLCH for color**: It's perceptually uniform, meaning equal steps in lightness *look* equal. Great for generating harmonious scales.

### Data Visualization
- **Charts & graphs**: Use color to encode categories or values
- **Heatmaps**: Color intensity shows density or importance
- **Comparison**: Color coding for different datasets or timeframes

### Borders & Accents
- **Hairline borders**: 1px colored borders on full perimeter (not side-stripes; see the absolute ban on `border-left/right > 1px`)
- **Underlines**: Color underlines for emphasis or active states
- **Dividers**: Subtle colored dividers instead of gray lines
- **Focus rings**: Colored focus indicators matching brand
- **Surface tints**: A 4-8% background wash of the accent color instead of a stripe

**NEVER**: `border-left` or `border-right` greater than 1px as a colored accent stripe. This is one of the three absolute bans in the parent skill. If you want to mark a card as "active" or "warning", use a full hairline border, a background tint, a leading glyph, or a numbered prefix. Not a side stripe.

### Typography Color
- **Colored headings**: Use brand colors for section headings (maintain contrast)
- **Highlight text**: Color for emphasis or categories
- **Labels & tags**: Small colored labels for metadata or categories

### Decorative Elements
- **Illustrations**: Add colored illustrations or icons
- **Shapes**: Geometric shapes in brand colors as background elements
- **Gradients**: Colorful gradient overlays or mesh backgrounds
- **Blobs/organic shapes**: Soft colored shapes for visual interest

## Balance & Refinement

Ensure color addition improves rather than overwhelms:

### Maintain Hierarchy
- **Dominant color** (60%): Primary brand color or most used accent
- **Secondary color** (30%): Supporting color for variety
- **Accent color** (10%): High contrast for key moments
- **Neutrals** (remaining): Gray/black/white for structure

### Accessibility
- **Contrast ratios**: Ensure WCAG compliance (4.5:1 for text, 3:1 for UI components)
- **Don't rely on color alone**: Use icons, labels, or patterns alongside color
- **Test for color blindness**: Verify red/green combinations work for all users

### Cohesion
- **Consistent palette**: Use colors from defined palette, not arbitrary choices
- **Systematic application**: Same color meanings throughout (green always = success)
- **Temperature consistency**: Warm palette stays warm, cool stays cool

**NEVER**:
- Use every color in the rainbow (choose 2-4 colors beyond neutrals)
- Apply color randomly without semantic meaning
- Put gray text on colored backgrounds. It looks washed out; use a darker shade of the background color or transparency instead
- Use pure gray for neutrals. Add subtle color tint (warm or cool) for depth
- Use pure black (`#000`) or pure white (`#fff`) for large areas
- Violate WCAG contrast requirements
- Use color as the only indicator (accessibility issue)
- Make everything colorful (defeats the purpose)
- Default to purple-blue gradients (AI slop aesthetic)

## Verify Color Addition

Test that colorization improves the experience:

- **Better hierarchy**: Does color guide attention appropriately?
- **Clearer meaning**: Does color help users understand states/categories?
- **More engaging**: Does the interface feel warmer and more inviting?
- **Still accessible**: Do all color combinations meet WCAG standards?
- **Not overwhelming**: Is color balanced and purposeful?

When the palette earns its place, hand off to `{{command_prefix}}impeccable polish` for the final pass.

## Live-mode signature params

When invoked from live mode, each variant MUST declare a `color-amount` param so the user can dial between a restrained accent and a drenched surface without regeneration. Author the variant's CSS against `var(--p-color-amount, 0.5)`, typically as the alpha multiplier on backgrounds, or as a scaling factor on the chroma axis in an OKLCH expression. 0 = neutral/monochrome, 1 = full saturation / dominant coverage.

```json
{"id":"color-amount","kind":"range","min":0,"max":1,"step":0.05,"default":0.5,"label":"Color amount"}
```

Layer 1-2 variant-specific params on top: palette selection (`steps` with named options), temperature warmth, or tint vs. true color. See `reference/live.md` for the full params contract.
