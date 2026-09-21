// Notebook schema types, presented under the names the dashboard runtime already uses.
//
// The notebook spec is served at v2beta1 but carries the dashboard v2 panel shape. That chain had
// to be forked under Notebook-prefixed names, because the shared one in the v2beta1 CUE package is
// what Dashboard v2beta1 serves (see apps/dashboard/kinds/v2beta1/notebook_spec.cue). This module
// maps the forked names back, so notebook code reads the same as dashboard code.
//
// When Notebook moves to a stable v2, point these aliases at the v2 types and then delete this
// file: every notebook module takes its schema types from here, so that is the only seam.

import {
  defaultCodeCellContentKind as generatedDefaultCodeCellContentKind,
  defaultLibraryPanelKind as generatedDefaultLibraryPanelKind,
  defaultMarkdownCellContentKind as generatedDefaultMarkdownCellContentKind,
  defaultSpec as generatedDefaultSpec,
  defaultV2PanelKind,
  defaultV2PanelSpec,
  defaultVizConfigKind,
  type CellContentKind as GeneratedCellContentKind,
  type CellKind as GeneratedCellKind,
  type CodeCellContentKind as GeneratedCodeCellContentKind,
  type LibraryPanelKind as GeneratedLibraryPanelKind,
  type MarkdownCellContentKind as GeneratedMarkdownCellContentKind,
  type NotebookElement as GeneratedNotebookElement,
  type NotebookLayoutItemKind as GeneratedNotebookLayoutItemKind,
  type NotebookLayoutKind as GeneratedNotebookLayoutKind,
  type PanelQueryKind as GeneratedPanelQueryKind,
  type Spec as GeneratedSpec,
  type V2PanelKind as GeneratedPanelKind,
} from '@grafana/schema/apis/notebook/v2beta1';

// Forked by the notebook spec so it can carry the dashboard v2 shape.
export const defaultPanelKind = defaultV2PanelKind;
export type PanelKind = GeneratedPanelKind;
export type LibraryPanelKind = GeneratedLibraryPanelKind;

/**
 * The two NotebookElement kinds that carry a panel. vizPanelToSchemaV2 returns exactly this union,
 * picking the library branch only when the VizPanel carries LibraryPanelBehavior.
 */
export type PanelElement = PanelKind | LibraryPanelKind;

// Shared with the dashboard spec, or notebook-only. Either way the generated name is already right.
export type CellContentKind = GeneratedCellContentKind;
export type CellKind = GeneratedCellKind;
export type CodeCellContentKind = GeneratedCodeCellContentKind;
export type MarkdownCellContentKind = GeneratedMarkdownCellContentKind;
export type NotebookElement = GeneratedNotebookElement;
export type NotebookLayoutItemKind = GeneratedNotebookLayoutItemKind;
export type NotebookLayoutKind = GeneratedNotebookLayoutKind;
export type PanelQueryKind = GeneratedPanelQueryKind;
export type Spec = GeneratedSpec;

export const defaultCodeCellContentKind = generatedDefaultCodeCellContentKind;
export const defaultLibraryPanelKind = generatedDefaultLibraryPanelKind;
export const defaultMarkdownCellContentKind = generatedDefaultMarkdownCellContentKind;
export const defaultSpec = generatedDefaultSpec;

/**
 * What the "Visualization" block type inserts: a real Panel element (not a bespoke cell kind), so a
 * notebook-authored visualization ends up on the same model as a panel added from a Dashboard or
 * Explore — see NotebookLayoutManager's buildCellFor. Starts with no datasource/query chosen
 * (buildVizPanelState seeds a single empty query) and defaults to a timeseries visualization,
 * matching the line-graph default the old Explore-style query cell used. Picking a different viz
 * type is future work.
 */
export function defaultVisualizationPanelKind(): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      ...defaultV2PanelSpec(),
      vizConfig: { ...defaultVizConfigKind(), group: 'timeseries' },
    },
  };
}
