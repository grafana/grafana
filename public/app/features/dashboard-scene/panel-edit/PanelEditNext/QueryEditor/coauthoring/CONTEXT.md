# PanelEditNext query coauthoring

Core owns entry UI, explicit query selection, session lifetime, previews and telemetry. A datasource supplies private language and editor contracts, both version 1. These contracts stay internal until a reviewed extension point replaces them.

The allowlisted `queryCoauthoring` restricted API (version 1) remains discoverable while disabled. Its availability observes the coauthoring flag, visual refresh and floating capability independently of listeners, panels and Assistant presentation. Entry UI requires an eligible registered listener. Otherwise `QueryEditorRenderer` retains the existing private inline adapter and `QueryCoauthoringSurface`, whose `useQueryCoauthoringSession` uses `useInlineAssistant`.

Entry IDs bind a single click's immutable text and ranges to its session. Sessions provide canonical context on demand; query revision and resolver context generation are separate staging fences. The optional language support hook determines editability: absent support is unknown, never inferred from guidance or speculative preparation. Descriptions remain readable for read-only and unknown adapters.

`PanelEditor` owns the engine through pane and Assistant remounts. Closing, collapsing or moving Assistant preserves the session; Resume uses the retained handle. Exit, panel departure, Focus removal, replacement or capability loss ends it. Proposed typed queries stay outside canonical runner queries until Accept. Manual edits stop the preview, and editor marks are cleared when projection ends.

Accept invalidates full-scene undo/redo snapshots and their obsolete tree-bound predecessors. A mixed batch containing such a snapshot is dropped as a unit; newer standalone actions and the session's own Undo remain available.
