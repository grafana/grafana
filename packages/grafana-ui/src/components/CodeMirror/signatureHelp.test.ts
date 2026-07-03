import { EditorSelection, EditorState } from '@codemirror/state';
import { showTooltip, type EditorView, type Tooltip } from '@codemirror/view';

import { signatureHelp } from './signatureHelp';
import { type SignatureHelp, type SignatureHelpProvider } from './types';

const HELP: SignatureHelp = {
  signatures: [
    {
      name: 'round',
      parameters: [{ label: 'value: number' }, { label: 'decimals: number' }],
      returnType: 'number',
      documentation: 'Rounds a number.',
    },
  ],
  activeSignature: 0,
  activeParameter: 1,
};

const stateFor = (provider: SignatureHelpProvider, doc = 'abcdef', pos = 0) =>
  EditorState.create({ doc, selection: EditorSelection.single(pos), extensions: [signatureHelp(provider)] });

const activeTooltip = (state: EditorState): Tooltip | undefined =>
  state.facet(showTooltip).find((tooltip): tooltip is Tooltip => tooltip != null);

// The rendering code ignores the view argument, so a stub is sufficient for tests.
const createTooltipDom = (tooltip: Tooltip) => tooltip.create({} as EditorView).dom;

describe('signatureHelp extension', () => {
  it('shows a tooltip anchored at the cursor when the provider returns help', () => {
    const tooltip = activeTooltip(stateFor(() => HELP, 'abcdef', 3));

    expect(tooltip).toBeDefined();
    expect(tooltip?.pos).toBe(3);
  });

  it('shows no tooltip when the provider returns null', () => {
    expect(activeTooltip(stateFor(() => null))).toBeUndefined();
  });

  it('shows no tooltip when the provider returns help without signatures', () => {
    const emptyHelp: SignatureHelp = { signatures: [], activeSignature: 0, activeParameter: 0 };

    expect(activeTooltip(stateFor(() => emptyHelp))).toBeUndefined();
  });

  it('recomputes the tooltip when the selection changes', () => {
    const provider: SignatureHelpProvider = (_state, pos) => (pos >= 3 ? HELP : null);
    const initial = stateFor(provider, 'abcdef', 0);

    expect(activeTooltip(initial)).toBeUndefined();

    const moved = initial.update({ selection: EditorSelection.single(3) }).state;

    expect(activeTooltip(moved)?.pos).toBe(3);
  });

  it('renders the signature with the active parameter marked', () => {
    const dom = createTooltipDom(activeTooltip(stateFor(() => HELP))!);

    expect(dom.querySelector('.cm-signature-help-label')?.textContent).toBe(
      'round(value: number, decimals: number): number'
    );
    expect(dom.querySelector('.cm-signature-help-active-param')?.textContent).toBe('decimals: number');
    expect(dom.querySelector('.cm-signature-help-doc')?.textContent).toBe('Rounds a number.');
  });

  it('renders parameter-less signatures without an active parameter', () => {
    const piHelp: SignatureHelp = {
      signatures: [{ name: 'pi', parameters: [], returnType: 'number' }],
      activeSignature: 0,
      activeParameter: 0,
    };

    const dom = createTooltipDom(activeTooltip(stateFor(() => piHelp))!);

    expect(dom.querySelector('.cm-signature-help-label')?.textContent).toBe('pi(): number');
    expect(dom.querySelector('.cm-signature-help-active-param')).toBeNull();
  });
});
