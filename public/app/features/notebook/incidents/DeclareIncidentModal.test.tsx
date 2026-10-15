import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { DeclareIncidentModal } from './DeclareIncidentModal';
import { STUB_DECLARE_TESTID, notebookIncidents, stubDeclareForm } from './testHelpers';
import { useNotebookIncidents } from './useNotebookIncidents';

jest.mock('./useNotebookIncidents', () => ({
  ...jest.requireActual('./useNotebookIncidents'),
  useNotebookIncidents: jest.fn(),
}));

const mockUseNotebookIncidents = jest.mocked(useNotebookIncidents);

function setup({ installed = true, title = 'PromQL query (4)' } = {}) {
  const { Stub, props } = stubDeclareForm();
  mockUseNotebookIncidents.mockReturnValue(notebookIncidents(installed ? { DeclareIncidentForm: Stub } : {}));
  const onDismiss = jest.fn();

  const rendered = render(<DeclareIncidentModal uid="nb1" title={title} onDismiss={onDismiss} />);

  return { ...rendered, props, onDismiss };
}

describe('DeclareIncidentModal', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    config.appUrl = 'https://grafana.example/';
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('renders nothing when IRM is not installed', () => {
    setup({ installed: false });

    expect(screen.queryByTestId(STUB_DECLARE_TESTID)).not.toBeInTheDocument();
  });

  // Their declare component brings its own Modal; wrapping it stacked two dialogs.
  it('adds no modal chrome of its own', () => {
    setup();

    expect(screen.getByTestId(STUB_DECLARE_TESTID)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // IRM persists attachCaption as the attachment's label, and t() escapes interpolated values.
  it('leaves punctuation in the caption alone', () => {
    const { props } = setup({ title: "Checkout's errors/sec" });

    expect(props.at(-1)?.attachCaption).toBe("Notebook: Checkout's errors/sec");
  });

  // Attached context, so the incident links back from the moment it exists.
  it('prefills the title and attaches the notebook as labelled context', () => {
    const { props } = setup();

    expect(props.at(-1)).toMatchObject({
      defaultTitle: 'PromQL query (4)',
      attachURL: 'https://grafana.example/notebooks/nb1',
      attachCaption: 'Notebook: PromQL query (4)',
    });
  });
});
