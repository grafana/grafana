> **Additional context needed**: target platforms/devices and usage contexts.

Adapt an existing design to a different context: another screen size, device, platform, or use case. The trap is treating adaptation as scaling. The job is rethinking the experience for the new context.


---

## Assess Adaptation Challenge

Understand what needs adaptation and why:

1. **Identify the source context**:
   - What was it designed for originally? (Desktop web? Mobile app?)
   - What assumptions were made? (Large screen? Mouse input? Fast connection?)
   - What works well in current context?

2. **Understand target context**:
   - **Device**: Mobile, tablet, desktop, TV, watch, print?
   - **Input method**: Touch, mouse, keyboard, voice, gamepad?
   - **Screen constraints**: Size, resolution, orientation?
   - **Connection**: Fast wifi, slow 3G, offline?
   - **Usage context**: On-the-go vs desk, quick glance vs focused reading?
   - **User expectations**: What do users expect on this platform?

3. **Identify adaptation challenges**:
   - What won't fit? (Content, navigation, features)
   - What won't work? (Hover states on touch, tiny touch targets)
   - What's inappropriate? (Desktop patterns on mobile, mobile patterns on desktop)

**CRITICAL**: Adaptation is rethinking the experience for the new context, not scaling pixels.

## Plan Adaptation Strategy

Create context-appropriate strategy:

### Mobile Adaptation (Desktop → Mobile)

**Layout Strategy**:
- Single column instead of multi-column
- Vertical stacking instead of side-by-side
- Full-width components instead of fixed widths
- Bottom navigation instead of top/side navigation

**Interaction Strategy**:
- Touch targets 44x44px minimum (not hover-dependent)
- Swipe gestures where appropriate (lists, carousels)
- Bottom sheets instead of dropdowns
- Thumbs-first design (controls within thumb reach)
- Larger tap areas with more spacing

**Content Strategy**:
- Progressive disclosure (don't show everything at once)
- Prioritize primary content (secondary content in tabs/accordions)
- Shorter text (more concise)
- Larger text (16px minimum)

**Navigation Strategy**:
- Hamburger menu or bottom navigation
- Reduce navigation complexity
- Sticky headers for context
- Back button in navigation flow

### Tablet Adaptation (Hybrid Approach)

**Layout Strategy**:
- Two-column layouts (not single or three-column)
- Side panels for secondary content
- Master-detail views (list + detail)
- Adaptive based on orientation (portrait vs landscape)

**Interaction Strategy**:
- Support both touch and pointer
- Touch targets 44x44px but allow denser layouts than phone
- Side navigation drawers
- Multi-column forms where appropriate

### Desktop Adaptation (Mobile → Desktop)

**Layout Strategy**:
- Multi-column layouts (use horizontal space)
- Side navigation always visible
- Multiple information panels simultaneously
- Fixed widths with max-width constraints (don't stretch to 4K)

**Interaction Strategy**:
- Hover states for additional information
- Keyboard shortcuts
- Right-click context menus
- Drag and drop where helpful
- Multi-select with Shift/Cmd

**Content Strategy**:
- Show more information upfront (less progressive disclosure)
- Data tables with many columns
- Richer visualizations
- More detailed descriptions

### Print Adaptation (Screen → Print)

**Layout Strategy**:
- Page breaks at logical points
- Remove navigation, footer, interactive elements
- Black and white (or limited color)
- Proper margins for binding

**Content Strategy**:
- Expand shortened content (show full URLs, hidden sections)
- Add page numbers, headers, footers
- Include metadata (print date, page title)
- Convert charts to print-friendly versions

### Email Adaptation (Web → Email)

**Layout Strategy**:
- Narrow width (600px max)
- Single column only
- Inline CSS (no external stylesheets)
- Table-based layouts (for email client compatibility)

**Interaction Strategy**:
- Large, obvious CTAs (buttons not text links)
- No hover states (not reliable)
- Deep links to web app for complex interactions

## Implement Adaptations

Apply changes systematically:

### Responsive Breakpoints

Choose appropriate breakpoints:
- Mobile: 320px-767px
- Tablet: 768px-1023px
- Desktop: 1024px+
- Or content-driven breakpoints (where design breaks)

### Layout Adaptation Techniques

- **CSS Grid/Flexbox**: Reflow layouts automatically
- **Container Queries**: Adapt based on container, not viewport
- **`clamp()`**: Fluid sizing between min and max
- **Media queries**: Different styles for different contexts
- **Display properties**: Show/hide elements per context

### Touch Adaptation

- Increase touch target sizes (44x44px minimum)
- Add more spacing between interactive elements
- Remove hover-dependent interactions
- Add touch feedback (ripples, highlights)
- Consider thumb zones (easier to reach bottom than top)

### Content Adaptation

- Use `display: none` sparingly (still downloads)
- Progressive enhancement (core content first, enhancements on larger screens)
- Lazy loading for off-screen content
- Responsive images (`srcset`, `picture` element)

### Navigation Adaptation

- Transform complex nav to hamburger/drawer on mobile
- Bottom nav bar for mobile apps
- Persistent side navigation on desktop
- Breadcrumbs on smaller screens for context

**IMPORTANT**: Test on real devices. Device emulation in DevTools is helpful but not perfect.

**NEVER**:
- Hide core functionality on mobile (if it matters, make it work)
- Assume desktop = powerful device (consider accessibility, older machines)
- Use different information architecture across contexts (confusing)
- Break user expectations for platform (mobile users expect mobile patterns)
- Forget landscape orientation on mobile/tablet
- Use generic breakpoints blindly (use content-driven breakpoints)
- Ignore touch on desktop (many desktop devices have touch)

## Verify Adaptations

Test thoroughly across contexts:

- **Real devices**: Test on actual phones, tablets, desktops
- **Different orientations**: Portrait and landscape
- **Different browsers**: Safari, Chrome, Firefox, Edge
- **Different OS**: iOS, Android, Windows, macOS
- **Different input methods**: Touch, mouse, keyboard
- **Edge cases**: Very small screens (320px), very large screens (4K)
- **Slow connections**: Test on throttled network

When the adaptation feels native to each context, hand off to `{{command_prefix}}impeccable polish` for the final pass.
