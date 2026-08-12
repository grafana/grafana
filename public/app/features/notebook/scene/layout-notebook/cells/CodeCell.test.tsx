import { render, screen } from 'test/test-utils';

import { type CellContentKind } from 'app/features/notebook/types';

import { CodeCell } from './CodeCell';

// Monaco does not run in jsdom. A textarea carries readOnly into the DOM, so the assertions are on
// rendered output rather than on props handed to a stub.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  // defaultValue, not value: a controlled textarea without onChange makes React warn as soon as it
  // is not read-only, which is precisely the case under test.
  CodeEditor: ({ value, readOnly }: { value: string; readOnly?: boolean }) => (
    <textarea aria-label="Code" defaultValue={value} readOnly={readOnly} />
  ),
}));

const content: CellContentKind = { kind: 'Code', spec: { code: 'select 1', language: 'sql' } };

describe('CodeCell', () => {
  it('is read only while the notebook is being read', () => {
    render(<CodeCell content={content} isEditing={false} />);

    expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
  });

  it('takes input once the notebook is being edited', () => {
    // Nothing persists the result yet; this only stops the editor refusing input.
    render(<CodeCell content={content} isEditing={true} />);

    expect(screen.getByLabelText('Code')).not.toHaveAttribute('readonly');
  });
});
