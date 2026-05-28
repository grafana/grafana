# Product

## Register

product

## Users

Site reliability engineers, DevOps engineers, platform engineers, and data analysts who monitor distributed systems. They stare at dashboards for hours — during on-call shifts, incident response, capacity planning, and performance reviews. Environment: dim rooms, large monitors, high cognitive load. Primary task on any given screen: reading data fast, understanding whether something is wrong, and navigating to the right panel or dashboard without losing context.

## Product Purpose

Grafana is an observability and data visualization platform. Users build dashboards that pull from any data source — Prometheus, Loki, Tempo, databases, cloud APIs — and visualize time-series data, logs, traces, and metrics in a shared, editable canvas. Success looks like: the data comes through without the chrome getting in the way, the user always knows where they are in the product hierarchy, and switching between viewing and editing is fluid enough that authoring feels like a natural extension of reading.

## Brand Personality

Deliberate, Expert, Assured. The product should feel like a precision instrument: capable without announcing itself, confident without being loud. Orange runs through every page as a deliberate brand signal — not decoration, not accent for its own sake, but a thread that ties every surface back to Grafana.

## Anti-references

- Neon-on-dark monitoring tool aesthetic: saturated chart series on pitch-black backgrounds that announce themselves before the data does. The exact look Grafana is leaving behind.
- Full-width-everything layout: forms, lists, and settings spanning an entire 27-inch monitor, forcing the eye to scan metres of empty space to find anything.
- Stacked toolbars: multiple bars of controls pushing the actual dashboard content off-screen on first load.
- Hidden editing state: users who can't tell at a glance whether they're in view mode or edit mode.
- Generic SaaS dashboard aesthetic: hero metrics with gradient accents, identical icon-grid cards, modals as the first answer to every problem.

## Design Principles

1. **The frame yields to content.** Dashboard chrome — controls, sidebars, headers — earns the smallest footprint it can get away with. Every pixel spent on the frame is a pixel taken from the data.
2. **A user always knows where they are.** The breadcrumb, the active nav state, and the page layout read position at a glance, no matter how deep the user has drilled through apps, plugins, and sub-pages.
3. **Colour stays soft across the whole product.** Chrome, badges, and chart series all live in a low-chroma palette. Saturated colour wins attention the moment a page loads and refuses to give it back. Holding chroma down keeps everything legible without wearing the user out.
4. **Accent sits on top of neutral chrome, never inside it.** Accent (Grafana orange) registers on primary actions, active states, and focus rings — never on hover backgrounds or secondary controls, where it would dilute its own meaning.
5. **Editing is a visible state, not a navigation event.** Entering edit mode transforms the canvas in place: the orange accent surfaces, new controls arrive, the "Editing" label confirms the mode. Leaving edit mode reverses cleanly. No navigation to a separate screen, no lost scroll position.

## Accessibility & Inclusion

WCAG AA. Reduced-motion support via `prefers-reduced-motion`. Colour contrast requirements met for both dark and light themes. All interactive elements keyboard-navigable with visible focus rings (1px accent + 3px accent glow).
