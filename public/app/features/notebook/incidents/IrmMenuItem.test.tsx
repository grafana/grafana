import { render, screen, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';

import { IrmMenuItem } from './IrmMenuItem';
import { notebookIncidents, stubAttachForm, stubDeclareForm } from './testHelpers';
import { useNotebookIncidents } from './useNotebookIncidents';

jest.mock('./useNotebookIncidents', () => ({
  ...jest.requireActual('./useNotebookIncidents'),
  useNotebookIncidents: jest.fn(),
}));

const mockUseNotebookIncidents = jest.mocked(useNotebookIncidents);

type Exposed = { declare?: boolean; attach?: boolean };

function setup({ declare = true, attach = true }: Exposed = {}) {
  mockUseNotebookIncidents.mockReturnValue(
    notebookIncidents({
      ...(declare ? { DeclareIncidentForm: stubDeclareForm().Stub } : {}),
      ...(attach ? { AttachToIncidentForm: stubAttachForm().Stub } : {}),
    })
  );
  const onDeclare = jest.fn();
  const onAttach = jest.fn();

  const rendered = render(
    <Menu>
      <IrmMenuItem onDeclare={onDeclare} onAttach={onAttach} />
    </Menu>
  );

  return { ...rendered, onDeclare, onAttach };
}

/** The group, by a name that starts with its label — it also contains every child's text. */
const group = () => screen.getByRole('menuitem', { name: /^IRM/ });

/**
 * Opens the submenu with the keyboard and returns it, scoped — the group's own accessible name
 * includes every child's text, so unscoped queries match the group.
 *
 * Only the contents are asserted, not activation: no gesture reaches a submenu child in jsdom.
 * Hover then click unmounts it as the pointer leaves the group, and ArrowRight leaves focus on the
 * group rather than moving into the submenu, so Enter never reaches an item. grafana-ui's own
 * MenuItem tests stop at the same line. Clicking through is covered manually instead.
 */
async function openSubmenu(user: ReturnType<typeof setup>['user']) {
  await user.type(group(), '{ArrowRight}');
  return within(await screen.findByTestId(selectors.components.Menu.SubMenu.container));
}

const itemLabels = (submenu: Awaited<ReturnType<typeof openSubmenu>>) =>
  submenu.getAllByRole('menuitem').map((item) => item.textContent);

describe('IrmMenuItem', () => {
  it('renders nothing when IRM exposes neither component', () => {
    setup({ declare: false, attach: false });

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  // Grouped rather than sitting in the root menu: most notebooks are not incident-related, and this
  // is how a dashboard files the same two actions.
  it('groups both actions under one IRM item', async () => {
    const { user } = setup();

    expect(itemLabels(await openSubmenu(user))).toEqual(['Declare incident', 'Attach to incident']);
  });

  // Menu.Item decides it has a submenu from childItems.length alone, so a child component that
  // rendered null here would open the submenu on a blank row.
  it('offers only the action whose component is exposed', async () => {
    const { user } = setup({ declare: false });

    expect(itemLabels(await openSubmenu(user))).toEqual(['Attach to incident']);
  });
});
