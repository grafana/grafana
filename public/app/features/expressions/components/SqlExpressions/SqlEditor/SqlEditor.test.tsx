import { sql as sqlLanguage } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import { render } from '@testing-library/react';

import { type SignatureHelpProvider } from '@grafana/ui/unstable';

import { SqlEditor } from './SqlEditor';

let editorProps: Record<string, unknown> | undefined;

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: (props: Record<string, unknown>) => {
    editorProps = props;
    return <div className="cm-scroller" />;
  },
}));

describe('SqlEditor', () => {
  beforeEach(() => {
    editorProps = undefined;
  });

  it('completes on space, so suggestions still open after FROM and in the SELECT list', () => {
    render(<SqlEditor value="SELECT * FROM " onChange={jest.fn()} completionProvider={{ tables: () => [] }} />);

    expect(editorProps?.completeOnSpace).toBe(true);
  });

  it('passes a signature help provider built from the function signatures', () => {
    render(
      <SqlEditor
        value="SELECT round("
        onChange={jest.fn()}
        functionSignatures={[{ name: 'round', parameters: [{ label: 'value: number' }] }]}
      />
    );

    const provider = editorProps?.signatureHelp as SignatureHelpProvider;
    const state = EditorState.create({ doc: 'SELECT round(', extensions: [sqlLanguage()] });
    expect(provider(state, state.doc.length)?.signatures.map((signature) => signature.name)).toEqual(['round']);
  });

  it('omits signature help when there are no function signatures', () => {
    render(<SqlEditor value="SELECT 1" onChange={jest.fn()} functionSignatures={[]} />);

    expect(editorProps?.signatureHelp).toBeUndefined();
  });

  it('contains horizontal overscroll within the editor', () => {
    render(<SqlEditor value="SELECT * FROM A" onChange={jest.fn()} />);

    const overscrollRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find((rule) => rule.cssText.includes('cm-scroller') && rule.cssText.includes('overscroll-behavior-x'));

    expect(overscrollRule?.cssText).toContain('overscroll-behavior-x: contain');
  });
});
