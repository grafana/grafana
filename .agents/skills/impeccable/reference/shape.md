Shape the UX and UI for a feature before any code is written. This command produces a **design brief**: a structured artifact that guides implementation through discovery, not guesswork.

**Scope**: Design planning only. This command does NOT write code. It produces the thinking that makes code good.

**Output**: A design brief that can be handed off to {{command_prefix}}impeccable craft, or directly to {{command_prefix}}impeccable for freeform implementation. When visual direction probes are used, the images are supporting artifacts, not the primary output.

## Philosophy

Most AI-generated UIs fail not because of bad code, but because of skipped thinking. They jump to "here's a card grid" without asking "what is the user trying to accomplish?" This command inverts that: understand deeply first, so implementation is precise.

## Phase 1: Discovery Interview

**Do NOT write any code or make any design decisions during this phase.** Your only job is to understand the feature deeply enough to make excellent design decisions later.

This is a required interaction, not optional guidance. Ask these questions in conversation, adapting based on answers. Don't dump them all at once; have a natural dialogue. {{ask_instruction}}

### Interview cadence

Discovery includes at least one user-answer round unless PRODUCT.md, DESIGN.md, or an already-confirmed brief directly answers the needed inputs. With a sparse prompt, do **not** synthesize a complete brief for confirmation on the first response.

- Use the harness's structured question tool when one exists. Otherwise, ask directly in chat and stop.
- Ask **2-3 questions per round**, then wait for answers.
- Treat PRODUCT.md and DESIGN.md as anchors; they reduce repeated questions but do **not** replace shape for craft. Shape is task-specific.
- One round is the default. Add a second only if the first answers leave material gaps. Don't run a second round just to feel thorough.
- Round 1 should clarify purpose, audience/context, content/scope, and (for brand) visual direction.
- Round 2, when needed, fills in whatever's still genuinely missing.

**Assert-then-confirm, not menu-with-escape.** When PRODUCT.md and the user's prompt make one option obvious, name it and ask the user to confirm or override. Don't enumerate "Restrained / Committed / Or something else?" as a real choice; "This reads as Restrained, confirm?" beats a four-option menu when the answer is already clear.

### Purpose & Context
- What is this feature for? What problem does it solve?
- Who specifically will use it? (Not "users"; be specific: role, context, frequency)
- What does success look like? How will you know this feature is working?
- What's the user's state of mind when they reach this feature? (Rushed? Exploring? Anxious? Focused?)

### Content & Data
- What content or data does this feature display or collect?
- What are the realistic ranges? (Minimum, typical, maximum, e.g., 0 items, 5 items, 500 items)
- What are the edge cases? (Empty state, error state, first-time use, power user)
- Is any content dynamic? What changes and how often?
- What visual assets are real content here? Note required images, product shots, illustrations, maps, textures, diagrams, generated objects, or existing project assets.

### Design Direction

Force a visual decision on three fronts. Skip anything PRODUCT.md or DESIGN.md already answers; ask only what's missing.

- **Color strategy for this surface.** Pick one: Restrained / Committed / Full palette / Drenched. Can override the project default if the surface earns it (e.g. a drenched hero inside an otherwise Restrained product).
- **Theme via scene sentence.** Write one sentence of physical context for this surface: who uses it, where, under what ambient light, in what mood. The sentence forces dark vs light. If it doesn't, add detail until it does.
- **Two or three named anchor references.** Specific products, brands, objects. Not adjectives like "modern" or "clean."

### Scope

Always ask. Sketch quality and shipped quality are different outputs; don't guess between them.

- **Fidelity.** Sketch / mid-fi / high-fi / production-ready?
- **Breadth.** One screen / a flow / a whole surface?
- **Interactivity.** Static visual / interactive prototype / shipped-quality component?
- **Time intent.** Quick exploration, or polish until it ships?

Scope answers are task-scoped. Don't write them to PRODUCT.md or DESIGN.md; carry them through the design brief only.

### Constraints
- Are there technical constraints? (Framework, performance budget, browser support)
- Are there content constraints? (Localization, dynamic text length, user-generated content)
- Mobile/responsive requirements?
- Accessibility requirements beyond WCAG AA?

### Anti-Goals
- What should this NOT be? What would be a wrong direction?
- What's the biggest risk of getting this wrong?

## Phase 1.5: Visual Direction Probe (Capability-Gated)

After the discovery interview, generate a small set of visual direction probes **before** writing the final brief when all of these are true:

- The work is **net-new** or directionally ambiguous enough that visual exploration will clarify the brief.
- The requested fidelity is **mid-fi, high-fi, or production-ready**. Skip for sketch-only planning.
- The current harness gives you native image generation (Codex's `image_gen`, an equivalent MCP tool, or similar). Don't ask the user to install APIs or tooling.

When those conditions are met, this step is mandatory. If image generation isn't natively available, do not ask the user to install APIs or tooling. State in one line that the image step is skipped because the harness lacks native image generation, then proceed. The one-line announcement is required, not optional; it forces a conscious decision instead of letting the step quietly evaporate.

Use probes to explore visual lanes, not to replace the brief.

Do not skip probes because the final UI will be semantic, editable, code-native, responsive, or accessible. Those are implementation requirements, not reasons to avoid visual exploration.

### What to generate

Generate **2 to 4** distinct direction probes based on the discovery answers, especially:

- Color strategy
- Theme scene sentence
- Named anchor references
- Scope and fidelity

The probes should differ in primary visual direction (hierarchy, topology, density, typographic voice, or color strategy), not just palette tweaks.

### How to use the probes

- Treat them as **direction tests**, not final designs.
- Use them to pressure-test whether the brief is pointing at the right lane.
- Ask the user which direction feels closest, what feels off, and what should carry forward.
- If the probes reveal a mismatch, revise the brief inputs before finalizing the brief.

### Important limits

- Do **not** skip discovery because image generation is available.
- Do **not** treat generated imagery as final UX specification, final copy, or final accessibility behavior.
- Do **not** use this step for minor refinements of existing work. It's for shaping a new surface or clarifying a big directional choice.

If image generation isn't natively available, announce the skip in one line and proceed to the design brief.

## Phase 2: Design Brief

After the interview and any required probes, present a brief and **end your response**. The user must confirm before any implementation runs. Do not present a brief and then continue to code in the same response, even if the brief feels obvious to you. The user's confirmation is the gate.

**Choose the brief shape based on how clear the answers are:**

- **Compact form (3-5 bullets)** when discovery was crisp and the original prompt + PRODUCT.md already pinned scope, content, and direction. State what you're building, the visual lane, and end with one or two specific questions or a clear "confirm or override?" prompt. This is the default for typical craft requests with a clear prompt.
- **Full structured form (sections below)** when the task is genuinely ambiguous, multi-screen, or when the user asked for shape as a standalone step. Use this when the discipline of structure earns its weight.

Don't pad a clear brief into a long one to look thorough. A 70-line brief restating answers the user just gave is noise, not rigor. Equally, don't skip the confirmation pause to look efficient: the pause is the point.

Present the brief, then **stop and wait for explicit confirmation**. You are not the judge of whether the user already approved. Even when the brief feels obviously right, ask once and wait. The pause is what separates shape from premature implementation.

### Brief Structure

**1. Feature Summary** (2-3 sentences)
What this is, who it's for, what it needs to accomplish.

**2. Primary User Action**
The single most important thing a user should do or understand here.

**3. Design Direction**
Color strategy (Restrained / Committed / Full palette / Drenched) + the theme scene sentence + 2–3 named anchor references. Reference PRODUCT.md and DESIGN.md where they already answer, and note any per-surface overrides.

If you ran the Visual Direction Probe step, name which probe direction won and what changed in the brief because of it.

**4. Scope**
Fidelity, breadth, interactivity, and time intent from the Scope section of the interview. Task-scoped; these don't persist beyond the brief.

**5. Layout Strategy**
High-level spatial approach: what gets emphasis, what's secondary, how information flows. Describe the visual hierarchy and rhythm, not specific CSS.

**6. Key States**
List every state the feature needs: default, empty, loading, error, success, edge cases. For each, note what the user needs to see and feel.

**7. Interaction Model**
How users interact with this feature. What happens on click, hover, scroll? What feedback do they get? What's the flow from entry to completion?

**8. Content Requirements**
What copy, labels, empty state messages, error messages, and microcopy are needed. Note any dynamic content and its realistic ranges. For image-led surfaces, also list the required image/media roles and their likely source (project asset, generated raster, semantic SVG/CSS, canvas/WebGL, icon library, or accepted omission).

**9. Recommended References**
Based on the brief, list which impeccable reference files would be most valuable during implementation (e.g., spatial-design.md for complex layouts, motion-design.md for animated features, interaction-design.md for form-heavy features).

**10. Open Questions**
Anything genuinely unresolved. Don't list "open questions" you've already recommended a default for; assert the default and move on. If you'd write `Recommend: X` next to a question, just decide X.

---

{{ask_instruction}} Ask for explicit confirmation of the brief before finishing.

If the user disagrees with any part, revisit the relevant discovery questions. A shape run is incomplete until the user confirms direction.

Once confirmed, the brief is complete. The user can now hand it to {{command_prefix}}impeccable, or use it to guide any other implementation approach. (If the user wants the full discovery-then-build flow in one step, they should use {{command_prefix}}impeccable craft instead, which runs this command internally.)
