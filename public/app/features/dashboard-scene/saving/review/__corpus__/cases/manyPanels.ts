import { dashboard, edit, elements, gridOf, panel, panelSpecOf, text } from '../builders';
import { type ReviewCorpusCase } from '../types';

const names = Array.from({ length: 11 }, (_, i) => `panel-${i + 1}`);

const baseline = dashboard({
  elements: elements(
    ...names.map((name, i): [string, ReturnType<typeof panel>] => [name, panel(`Node ${i + 1}`, { id: i + 1 })])
  ),
  layout: gridOf(...names),
});

export const manyPanels: ReviewCorpusCase = {
  name: 'more than 10 changed panels start collapsed',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline,
    payload: edit(baseline, (d) => {
      names.forEach((name) => {
        panelSpecOf(d, name).transparent = true;
      });
    }),
  },
  expected: text`
Changes to 11 panels
Counts: 0 added, 11 changed, 0 removed, 0 moved
Panels start collapsed

Panel "Node 1" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 2" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 3" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 4" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 5" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 6" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 7" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 8" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 9" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 10" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on

Panel "Node 11" was updated (1 change) · properties
  [Properties]
    Transparent background: turned on
`,
};
