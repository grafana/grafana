/**
 * The prompt that hands a panel to an agent.
 *
 * Identity, not content. The Notebooks export pushed a whole document as text, which
 * is what forced truncation and an 8000-character ceiling into existence; naming the
 * panel instead costs a few hundred characters and lets the agent fetch the rest
 * through the Grafana MCP server, which is also the only shape that can end in a
 * live panel rather than a description of one.
 *
 * No Grafana url either, deliberately: Cursor's deep link handler mis-parses
 * embedded urls, and a link the agent cannot follow is worse than one the prompt
 * never promised.
 */

/** Which resource holds the panel. `notebook` exists because Notebooks is landing as its own kind. */
export type PanelResourceKind = 'dashboard' | 'notebook';

export interface PanelHandoff {
  resourceKind: PanelResourceKind;
  resourceUid: string;
  panelId: number;
  panelTitle?: string;
  panelType: string;
  /** Raw range as the dashboard states it, so `now-6h` stays relative on the other side. */
  from: string;
  to: string;
}

export function buildPanelHandoffPrompt(handoff: PanelHandoff): string {
  const { resourceKind, resourceUid, panelId, panelTitle, panelType, from, to } = handoff;
  // The id comes along in the sentence only when a title is doing the naming, so an
  // untitled panel does not read as "panel 3 (panel 3)".
  const named = panelTitle ? `the "${panelTitle}" panel (panel ${panelId})` : `panel ${panelId}`;

  // Two sentences, because the agent shows this prompt to the user as the message it
  // answers. A block of indented tool arguments reads as machinery leaking out of the
  // button; the same facts in a sentence read as the request someone made.
  return [
    `Show me ${named} from Grafana ${resourceKind} ${resourceUid}, over ${from} to ${to}.`,
    '',
    // Terminal on purpose. A coding agent handed a data payload will describe it,
    // and one handed a panel it thinks is incomplete will go and rebuild the missing
    // part by hand - which is what happens without the last sentence.
    `Call run_panel_query once with ${resourceKind}Uid "${resourceUid}" and panelIds [${panelId}], start "${from}", ` +
      `end "${to}". It returns every query the panel has, and rendering it draws the whole ${panelType} panel. ` +
      'Stop there: no summary of the values, no second chart, nothing rebuilt by hand.',
  ].join('\n');
}
