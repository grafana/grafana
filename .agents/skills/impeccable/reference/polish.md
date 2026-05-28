> **Additional context needed**: quality bar (MVP vs flagship).

Perform a meticulous final pass to catch all the small details that separate good work from great work. The difference between shipped and polished.

Detector and automated QA output are defect evidence only. A clean script result is never proof that the design is strong; gather browser evidence and inspect the real interaction path.

## Design System Discovery

Aligning the feature to the design system is **not optional**. Polish without alignment is decoration on top of drift, and it makes the next person's job harder. Discovery comes before any other polish work.

1. **Find the design system**: Search for design system documentation, component libraries, style guides, or token definitions. Study the core patterns: design principles, target audience, color tokens, spacing scale, typography styles, component API, motion conventions.
2. **Note the conventions**: How are shared components imported? What spacing scale is used? Which colors come from tokens vs hard-coded values? What motion and interaction patterns are established? What flow shapes are used for comparable actions (modal vs full-page, inline vs route, save-on-blur vs explicit submit)?
3. **Identify drift, then name the root cause**: For every deviation, classify it as a **missing token** (the value should exist in the system but doesn't), a **one-off implementation** (a shared component already exists but wasn't used), or a **conceptual misalignment** (the feature's flow, IA, or hierarchy doesn't match neighboring features). The fix differs by category: patch the value, swap to the shared component, or rework the flow. Fixing the symptom without naming the cause is how drift compounds.

If a design system exists, polish **must** align the feature with it. If none exists, polish against the conventions visible in the codebase. **If anything about the system is ambiguous, ask. Never guess at design system principles.**

## Pre-Polish Assessment

Understand the current state and goals before touching anything:

1. **Review completeness**:
   - Is it functionally complete?
   - Are there known issues to preserve (mark with TODOs)?
   - What's the quality bar? (MVP vs flagship feature?)
   - When does it ship? (How much time for polish?)

2. **Think experience-first**: Who actually uses this, and what's the best possible experience for them? Effective design beats decorative polish; a feature that looks beautiful but fights the user's flow is not polished. Walk the path from their perspective before opening DevTools.

3. **Identify polish areas**:
   - Visual inconsistencies
   - Spacing and alignment issues
   - Interaction state gaps
   - Copy inconsistencies
   - Edge cases and error states
   - Loading and transition smoothness
   - Information architecture and flow drift (does this feature reveal complexity the way neighboring features do?)

4. **Pull in any prior critique** (optional signal): If `{{command_prefix}}impeccable critique` has been run on the same target, its priority issues are a useful prior for what to address first. Resolve the target to a file path or URL, then:
   ```bash
   slug=$(node {{scripts_path}}/critique-storage.mjs slug "<resolved>")
   node {{scripts_path}}/critique-storage.mjs latest "$slug"
   ```
   Exit 0 with body = found; fold the P0/P1 items into your polish list and mention the snapshot path so the user sees what you read. Exit 2 = no snapshot, continue without it. The critique is one input among many. Do your own pass either way.

5. **Triage cosmetic vs functional**: Classify each issue as **cosmetic** (looks off, doesn't impede the user) or **functional** (breaks, blocks, or confuses the experience). When polish time is tight, functional issues ship first; cosmetic ones can land in a follow-up. Quality should be consistent; never perfect one corner while leaving another rough.

**CRITICAL**: Polish is the last step, not the first. Don't polish work that's not functionally complete.

## Polish Systematically

Work through these dimensions methodically:

### Visual Alignment & Spacing

- **Pixel-perfect alignment**: Everything lines up to grid
- **Consistent spacing**: All gaps use spacing scale (no random 13px gaps)
- **Optical alignment**: Adjust for visual weight (icons may need offset for optical centering)
- **Responsive consistency**: Spacing and alignment work at all breakpoints
- **Grid adherence**: Elements snap to baseline grid

**Check**:
- Enable grid overlay and verify alignment
- Check spacing with browser inspector
- Test at multiple viewport sizes
- Look for elements that "feel" off

### Information Architecture & Flow

Visual polish on a misshapen flow is wasted work. Match the *shape* of the experience to the system, not just the surface.

- **Progressive disclosure**: Match how much is revealed when, compared to neighboring features. A settings page exposing 40 fields when the rest of the app reveals 5 at a time is drift, even if every field is perfectly styled.
- **Established user flows**: Multi-step actions follow the same shape as comparable flows elsewhere: modal vs full-page, inline edit vs separate route, save-on-blur vs explicit submit, optimistic vs pessimistic updates.
- **Hierarchy & complexity**: The same conceptual weight gets the same visual weight throughout. Primary actions don't become tertiary in one corner of the product, and tertiary actions don't shout.
- **Empty, loading, and arrival transitions**: How content arrives, updates, and leaves matches how it does in adjacent features.
- **Naming and mental model**: The feature uses the same nouns and verbs as the rest of the system. A "Workspace" here shouldn't be a "Project" three screens away.

### Typography Refinement

- **Hierarchy consistency**: Same elements use same sizes/weights throughout
- **Line length**: 45-75 characters for body text
- **Line height**: Appropriate for font size and context
- **Widows & orphans**: No single words on last line
- **Hyphenation**: Appropriate for language and column width
- **Kerning**: Adjust letter spacing where needed (especially headlines)
- **Font loading**: No FOUT/FOIT flashes

### Color & Contrast

- **Contrast ratios**: All text meets WCAG standards
- **Consistent token usage**: No hard-coded colors, all use design tokens
- **Theme consistency**: Works in all theme variants
- **Color meaning**: Same colors mean same things throughout
- **Accessible focus**: Focus indicators visible with sufficient contrast
- **Tinted neutrals**: No pure gray or pure black; add subtle color tint (0.01 chroma)
- **Gray on color**: Never put gray text on colored backgrounds; use a shade of that color or transparency

### Interaction States

Every interactive element needs all states:

- **Default**: Resting state
- **Hover**: Subtle feedback (color, scale, shadow)
- **Focus**: Keyboard focus indicator (never remove without replacement)
- **Active**: Click/tap feedback
- **Disabled**: Clearly non-interactive
- **Loading**: Async action feedback
- **Error**: Validation or error state
- **Success**: Successful completion

**Missing states create confusion and broken experiences**.

### Micro-interactions & Transitions

- **Smooth transitions**: All state changes animated appropriately (150-300ms)
- **Consistent easing**: Use ease-out-quart/quint/expo for natural deceleration. Never bounce or elastic; they feel dated.
- **No jank**: Smooth animations; use atmospheric blur/filter/mask/shadow effects when they add polish, but bound expensive paint areas and avoid casual layout-property animation
- **Appropriate motion**: Motion serves purpose, not decoration
- **Reduced motion**: Respects `prefers-reduced-motion`

### Content & Copy

- **Consistent terminology**: Same things called same names throughout
- **Consistent capitalization**: Title Case vs Sentence case applied consistently
- **Grammar & spelling**: No typos
- **Appropriate length**: Not too wordy, not too terse
- **Punctuation consistency**: Periods on sentences, not on labels (unless all labels have them)

### Icons & Images

- **Consistent style**: All icons from same family or matching style
- **Appropriate sizing**: Icons sized consistently for context
- **Proper alignment**: Icons align with adjacent text optically
- **Alt text**: All images have descriptive alt text
- **Loading states**: Images don't cause layout shift, proper aspect ratios
- **Retina support**: 2x assets for high-DPI screens

### Forms & Inputs

- **Label consistency**: All inputs properly labeled
- **Required indicators**: Clear and consistent
- **Error messages**: Helpful and consistent
- **Tab order**: Logical keyboard navigation
- **Auto-focus**: Appropriate (don't overuse)
- **Validation timing**: Consistent (on blur vs on submit)

### Edge Cases & Error States

- **Loading states**: All async actions have loading feedback
- **Empty states**: Helpful empty states, not just blank space
- **Error states**: Clear error messages with recovery paths
- **Success states**: Confirmation of successful actions
- **Long content**: Handles very long names, descriptions, etc.
- **No content**: Handles missing data gracefully
- **Offline**: Appropriate offline handling (if applicable)

### Responsiveness

- **All breakpoints**: Test mobile, tablet, desktop
- **Touch targets**: 44x44px minimum on touch devices
- **Readable text**: No text smaller than 14px on mobile
- **No horizontal scroll**: Content fits viewport
- **Appropriate reflow**: Content adapts logically

### Performance

- **Fast initial load**: Optimize critical path
- **No layout shift**: Elements don't jump after load (CLS)
- **Smooth interactions**: No lag or jank
- **Optimized images**: Appropriate formats and sizes
- **Lazy loading**: Off-screen content loads lazily

### Code Quality

- **Remove console logs**: No debug logging in production
- **Remove commented code**: Clean up dead code
- **Remove unused imports**: Clean up unused dependencies
- **Consistent naming**: Variables and functions follow conventions
- **Type safety**: No TypeScript `any` or ignored errors
- **Accessibility**: Proper ARIA labels and semantic HTML

## Polish Checklist

Go through systematically:

- [ ] Aligned to the design system (drift named and resolved by root cause)
- [ ] Information architecture and flow shape match neighboring features
- [ ] Visual alignment perfect at all breakpoints
- [ ] Spacing uses design tokens consistently
- [ ] Typography hierarchy consistent
- [ ] All interactive states implemented
- [ ] All transitions smooth (60fps)
- [ ] Copy is consistent and polished
- [ ] Icons are consistent and properly sized
- [ ] All forms properly labeled and validated
- [ ] Error states are helpful
- [ ] Loading states are clear
- [ ] Empty states are welcoming
- [ ] Touch targets are 44x44px minimum
- [ ] Contrast ratios meet WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] No console errors or warnings
- [ ] No layout shift on load
- [ ] Works in all supported browsers
- [ ] Respects reduced motion preference
- [ ] Code is clean (no TODOs, console.logs, commented code)

**IMPORTANT**: Polish is about details. Zoom in. Squint at it. Use it yourself. The little things add up.

Sweat the details. Zoom in until the alignment is right and the spacing reads as deliberate. Then ship.

**NEVER**:
- Polish before it's functionally complete
- Polish without aligning to the design system; that's decoration on drift
- Guess at design system principles instead of asking when something is ambiguous
- Spend hours on polish if it ships in 30 minutes (triage)
- Introduce bugs while polishing (test thoroughly)
- Ignore systematic issues (if spacing is off everywhere, fix the system, not just one screen)
- Perfect one thing while leaving others rough (consistent quality level)
- Create new one-off components when design system equivalents exist
- Hard-code values that should use design tokens
- Introduce new patterns or flows that diverge from established ones

## Final Verification

Before marking as done:

- **Use it yourself**: Actually interact with the feature.
- **Test on real devices**: Not just browser DevTools.
- **Ask someone else to review**: Fresh eyes catch things.
- **Compare to design**: Match intended design.
- **Check all states**: Don't just test happy path.
- **Treat automation carefully**: Run detector or QA commands when they are available and relevant, fix their defects, but never cite a clean result as proof that the work is polished.

## Clean Up

After polishing, ensure code quality:

- **Replace custom implementations**: If the design system provides a component you reimplemented, switch to the shared version.
- **Remove orphaned code**: Delete unused styles, components, or files made obsolete by polish.
- **Consolidate tokens**: If you introduced new values, check whether they should be tokens.
- **Verify DRYness**: Look for duplication introduced during polishing and consolidate.
