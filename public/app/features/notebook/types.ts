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
  defaultLibraryPanelKind as generatedDefaultLibraryPanelKind,
  defaultSpec as generatedDefaultSpec,
  defaultV2PanelKind,
  type CellContentKind as GeneratedCellContentKind,
  type CellKind as GeneratedCellKind,
  type CodeCellContentKind as GeneratedCodeCellContentKind,
  type MarkdownCellContentKind as GeneratedMarkdownCellContentKind,
  type NotebookElement as GeneratedNotebookElement,
  type NotebookLayoutItemKind as GeneratedNotebookLayoutItemKind,
  type NotebookLayoutKind as GeneratedNotebookLayoutKind,
  type Spec as GeneratedSpec,
} from '@grafana/schema/apis/notebook/v2beta1';

// Forked by the notebook spec so it can carry the dashboard v2 shape.
export const defaultPanelKind = defaultV2PanelKind;

// Shared with the dashboard spec, or notebook-only. Either way the generated name is already right.
export type CellContentKind = GeneratedCellContentKind;
export type CellKind = GeneratedCellKind;
export type CodeCellContentKind = GeneratedCodeCellContentKind;
export type MarkdownCellContentKind = GeneratedMarkdownCellContentKind;
export type NotebookElement = GeneratedNotebookElement;
export type NotebookLayoutItemKind = GeneratedNotebookLayoutItemKind;
export type NotebookLayoutKind = GeneratedNotebookLayoutKind;
export type Spec = GeneratedSpec;

export const defaultLibraryPanelKind = generatedDefaultLibraryPanelKind;
export const defaultSpec = generatedDefaultSpec;
