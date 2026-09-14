import { render, screen } from 'test/test-utils';

import { Menu } from '@grafana/ui';

import { DeclareIncidentMenuItem } from './DeclareIncidentMenuItem';
import { notebookIncidents, stubDeclareForm } from './testHelpers';
import { useNotebookIncidents } from './useNotebookIncidents';

jest.mock('./useNotebookIncidents', () => ({
  ...jest.requireActual('./useNotebookIncidents'),
  useNotebookIncidents: jest.fn(),
}));

const mockUseNotebookIncidents = jest.mocked(useNotebookIncidents);

function setup({ installed = true } = {}) {
  mockUseNotebookIncidents.mockReturnValue(
    notebookIncidents(installed ? { DeclareIncidentForm: stubDeclareForm().Stub } : {})
  );
  const onSelect = jest.fn();

  const rendered = render(
    <Menu>
      <DeclareIncidentMenuItem onSelect={onSelect} />
    </Menu>
  );

  return { ...rendered, onSelect };
}

describe('DeclareIncidentMenuItem', () => {
  // Absent rather than disabled-with-a-tooltip, which is what alerting's shared item does.
  it('renders nothing at all when IRM is not installed', () => {
    setup({ installed: false });

    expect(screen.queryByText('Declare incident')).not.toBeInTheDocument();
  });

  // A plain item, not a link: the form opens in place.
  it('raises the modal rather than navigating away', async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole('menuitem', { name: 'Declare incident' }));

    expect(onSelect).toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Declare incident' })).not.toHaveAttribute('href');
  });
});
