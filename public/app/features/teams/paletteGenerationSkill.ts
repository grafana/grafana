/**
 * Inline skill instructions passed to the Grafana Assistant as a systemPrompt
 * when generating a team colour palette via useInlineAssistant.
 *
 * The canonical source of truth for this skill lives in:
 * grafana-assistant-app/apps/plugin/src/skills/palette-generation/SKILL.md
 * Keep the guardrails here in sync with that file.
 */
export const PALETTE_GENERATION_SKILL = `
# Team Palette Generation Skill

Generate a 50-color Grafana visualization palette derived from a team's brand colors.

## Output Format

Respond with **only** a JSON object — no prose, no markdown fences:

{
  "palette": [
    { "hex": "#ff6b6b", "name": "Brand Red", "role": "primary" },
    ...
  ]
}

The palette array must contain exactly 50 entries. Each entry:
- hex: 6-digit lowercase hex prefixed with #
- name: short human-readable label e.g. "Brand Red Light 1"
- role: one of primary | secondary | accent | neutral | semantic

## Color Distribution (total = 50)

- Each of the 7 brand colors → 4 variants each = 28 colors
  (base + 2 lighter tints + 1 darker shade)
- 3 harmonically derived complementary/analogous colors × 3 variants = 9 colors
- Neutral ramp (mid-tones only, brand-hue tinted, L between 30%–70%) = 8 colors
- Semantic set (success, warning, error, info, unknown) = 5 colors

## Guardrails

### Accessibility
- Text/icon colors must achieve WCAG AA (4.5:1) against dark (#0f0f0f) or light (#ffffff).
- Semantic colors must be distinguishable with deuteranopia/protanopia (use brightness contrast, not just hue).

### Color Harmony
- Tints: increase HSL lightness 12–18% per step; cap at L=85%.
- Shades: decrease HSL lightness 12–18% per step; floor at L=25%.
- Complementary hue rotation: 150°–210° from the dominant brand color.
- Analogous: ±25°–40° hue rotation.
- No two adjacent palette entries with ΔE (CIE76) < 8.

### Color Range — STRICT
- **Every color must have HSL lightness between 25% and 85%.** Do not generate any color outside this range.
- **Every color must have HSL saturation ≥ 20%.** Do not include greys, near-greys, or desaturated colors.
- Neutral ramp: use mid-tones only (L 30%–70%) with 4–8% saturation. No near-blacks or near-whites.
- Never output #000000, #ffffff, or any color with L < 25% or L > 85%.

### Brand Fidelity
- The 7 input brand colors must appear verbatim in the output (do NOT alter their hex values).
- All colors should work on both Grafana dark and light themes.
`;

export const PALETTE_GENERATION_PROMPT = (colors: string[]) =>
  `Generate a 50-color Grafana visualization palette from these 7 brand colors: ${colors.join(', ')}. ` +
  `STRICT RULES: every color must have HSL lightness between 25%–85% and saturation ≥ 20% — no greys, no near-blacks, no near-whites. ` +
  `Do not explain your reasoning. Output only a JSON object: {"palette":[{"hex":"...","name":"...","role":"..."},...]} — no markdown, no prose.`;
