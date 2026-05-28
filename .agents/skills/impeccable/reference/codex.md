# Codex: Visual Direction & Asset Production

This file is loaded by `{{command_prefix}}impeccable craft` when the harness has native image generation (currently Codex via `image_gen`). Other harnesses skip it. It covers the two craft steps that depend on real image generation: landing the visual direction, and producing the raster assets the implementation will compose.

Read this *before* generating any images. The order matters, and the per-step user pauses are what keep generated imagery from drifting away from the brief.

### Four stop points before code

Steps A through D each end with the user. Do not advance past any of them on your own read of the situation.

1. **STOP after Step A questions.** Wait for answers.
2. **STOP after Step B palette generation.** Wait for "confirm palette."
3. **STOP after Step C mocks.** Wait for direction approval or delegation.
4. **Only after Step D approves a direction** do you return to craft.md Step 4 and write code.

Prior shape approval does **not** satisfy any of these. Shape's "confirm or override" advances you into Step A; it is not a substitute for it.

## Step A: Explore Directions with the User

Before generating anything, run a brief direction conversation grounded in the shape brief.

**Step A is required even when shape just produced a confirmed brief.** The shape questions and Step A questions cover different ground: shape pins purpose, content, scope; Step A pins palette, atmosphere, and named visual references for the comps you're about to generate. The only time you can skip Step A is when the user has already answered these exact palette/atmosphere/reference questions in the same session.

Ask **2-3 targeted questions** about visual lane, color strategy, atmosphere, and named anchor references. Don't enumerate generic menus; tie each question to the shape brief's answers. Example shape-grounded questions:

- "Brief says 'editorial restraint, Klim-adjacent.' Are we closer to a quiet specimen page or a magazine-spread feel with hero imagery?"
- "Palette strategy from shape was 'Committed.' Want it warm-grounded (deep oxblood + cream) or cool-grounded (slate + paper white)?"

**STOP and wait for answers.** These pin the palette before any pixel gets generated. Do not proceed to Step B until the user has responded.

## Step B: Generate the Brand Palette First

Generate **one** palette artifact before any mocks. This is a small, focused image: typography pairing on the chosen background, primary + accent color swatches, one signature ornament or motif. Single image, single pass.

Why palette first: mocks generated against a vague color sense produce noise that drowns out the structural decisions. A confirmed palette is the first concrete contract for everything downstream.

Show the palette to the user. Ask one question: "This is the palette I'm locking in for the mocks. Confirm, or call out what to shift?"

**STOP and wait for confirmation.** Do not generate mocks against an unconfirmed palette. "Probably good enough" is the wrong call here; the palette is the contract for everything downstream.

## Step C: Generate 1-3 Visual Mocks Against the Palette

Once the palette is confirmed, generate **1 to 3** high-fidelity north-star comps. Each mock must use the confirmed palette and typography. Mocks differ in *structural* direction (hierarchy, topology, density, composition), not in color or motif.

- Brand work: push visual identity, composition, mood, and signature motifs.
- Product work: push hierarchy, topology, density, tone, grounded in realistic product structure.
- Landing pages and long-form brand surfaces: show enough of the second fold to establish the system beyond the hero.

Use the `image_gen` tool directly (or via the imagegen skill when available). Don't ask the user to install anything.

## Step D: Approval Loop

Show the comps. Ask what carries forward. Iterate until **one direction is approved** or the user explicitly delegates.

**STOP and wait for the approval or the delegation.** Do not begin Step E or return to craft.md Step 4 until a single direction is named. If the user delegates, pick the strongest direction and explain it from the brief, not personal taste.

Before moving to assets, summarize what to carry into code and what *not* to literalize from the mock. This is the handoff between visual exploration and semantic implementation.

## Step E: Mock Fidelity Inventory

Inventory the approved mock's major visible ingredients. For each, decide implementation: semantic HTML/CSS/SVG, generated raster, sourced raster, icon library, canvas/WebGL, or accepted omission.

Common ingredients to inventory:

- Hero silhouette and dominant composition
- Signature motifs (planets, devices, portraits, charts, route lines, insets, badges, etc.)
- Nav and primary CTA treatment
- Section sequence, especially the second fold
- Image-native content the concept depends on
- Typography, density, color/material treatment, motion cues

Treat the mock as a north star, not a screenshot to trace. Don't rasterize core UI text. But if the live result lacks the mock's major ingredients, the implementation is wrong.

If a photographic, architectural, product, or place-led mock becomes generic CSS scenery, decorative diagrams, bullets, or copy, stop and fix it. That's a broken implementation, not a harmless interpretation.

Don't substitute a different hero composition or visual driver post-approval without user sign-off.

## Step F: Asset Slicing via the Asset Producer

Raster ingredients identified in Step E need clean production assets. Use the bundled `impeccable_asset_producer` subagent rather than producing inline.

Spawn it as a scoped subagent. If you do not have explicit permission to use agents, stop and ask:

```text
Asset production will work better as a scoped subagent job. Should I spawn the Impeccable asset producer subagent for this step?
```

Pass to the agent:

- Approved mock path or screenshot reference
- Crop paths or a contact sheet with crop ids
- Output directory
- Required dimensions, format, transparency needs
- Avoid list
- Notes on what should remain semantic HTML/CSS/SVG instead of raster

Attach image generation capability to the spawned agent when the harness supports it. Do **not** load image-generation reference material into the parent thread.

Inline asset production is allowed only if the user declines subagents, the harness cannot spawn the authorized agent, or the user explicitly asks for single-thread mode.

Prefer HTML/CSS/SVG/canvas when they can credibly reproduce an ingredient; reach for real, generated, or stock imagery when the mock or subject matter calls for actual visual content.

## After This File

Once Steps A through F are complete, return to `craft.md` Step 5 (Build to Production Quality). The implementation builds against the confirmed palette, approved mock, and the assets the producer wrote.
