import { getExposeAssistantFunctionsConfig, newFunctionNamespace } from '@grafana/assistant';
import { type PluginExtensionAddedFunctionConfig } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { panelFromAssistantArgs, type AssistantPanelArgs } from '../addToNotebook/panelFromAssistantArgs';
import { createNotebook, fetchNotebook, fetchNotebooks, notebookViewUrl, saveNotebook } from '../api/notebookAPI';
import { insertElement, newMarkdownElement, newNotebookSpec } from '../model/notebookSpec';

function assertNotebooksEnabled() {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)) {
    throw new Error('Notebooks are not enabled on this instance (feature flag dashboard.notebooks).');
  }
}

/**
 * Exposes notebook operations to the Grafana Assistant via its callback extension
 * point. This is the "conversation entry point" from the Assistant/Workspace: the
 * assistant can list notebooks, create one from a conversation summary, and append
 * findings to an existing notebook (cells are attributed to `source: assistant`).
 * Registration is inert when the assistant app is not installed.
 */
export function getNotebookAssistantFunctionConfigs(): PluginExtensionAddedFunctionConfig[] {
  return [
    getExposeAssistantFunctionsConfig([
      newFunctionNamespace('notebooks', {
        /** Lists the user's notebooks with their uids and urls. */
        listNotebooks: async () => {
          assertNotebooksEnabled();
          const notebooks = await fetchNotebooks();
          return notebooks.map((nb) => ({
            uid: nb.metadata.name,
            title: nb.spec.title,
            description: nb.spec.description ?? '',
            tags: nb.spec.tags,
            url: notebookViewUrl(nb.metadata.name),
          }));
        },

        /**
         * Creates a notebook, optionally seeded with markdown content (e.g. a
         * conversation or investigation summary). Returns { uid, url, title }.
         */
        createNotebook: async (args?: { title?: string; markdown?: string }) => {
          assertNotebooksEnabled();
          let spec = newNotebookSpec(args?.title?.trim() || 'Assistant investigation');
          if (args?.markdown) {
            spec = insertElement(spec, newMarkdownElement(args.markdown), { source: 'assistant' }).spec;
          }
          const created = await createNotebook(spec);
          return { uid: created.metadata.name, title: created.spec.title, url: notebookViewUrl(created.metadata.name) };
        },

        /** Appends a markdown cell (attributed to the assistant) to an existing notebook. */
        appendMarkdown: async (args: { uid: string; markdown: string }) => {
          assertNotebooksEnabled();
          if (!args?.uid || !args?.markdown) {
            throw new Error('appendMarkdown requires { uid, markdown }.');
          }
          const notebook = await fetchNotebook(args.uid);
          const { spec } = insertElement(notebook.spec, newMarkdownElement(args.markdown), { source: 'assistant' });
          const saved = await saveNotebook({ ...notebook, spec });
          return { uid: saved.metadata.name, title: saved.spec.title, url: notebookViewUrl(saved.metadata.name) };
        },

        /**
         * Appends a live visualization panel (attributed to the assistant) to an existing
         * notebook. Example: { uid, title: "Error rate", vizType: "timeseries",
         * datasourceUid: "abc", datasourceType: "prometheus", queries: [{ expr: "up" }] }.
         */
        appendPanel: async (args: AssistantPanelArgs & { uid: string }) => {
          assertNotebooksEnabled();
          if (!args?.uid) {
            throw new Error('appendPanel requires a notebook uid.');
          }
          if (!args.datasourceUid || !args.queries?.length) {
            throw new Error('appendPanel requires datasourceUid and at least one query.');
          }
          const notebook = await fetchNotebook(args.uid);
          const { spec } = insertElement(notebook.spec, panelFromAssistantArgs(args), { source: 'assistant' });
          const saved = await saveNotebook({ ...notebook, spec });
          return { uid: saved.metadata.name, title: saved.spec.title, url: notebookViewUrl(saved.metadata.name) };
        },
      }),
    ]),
  ];
}
