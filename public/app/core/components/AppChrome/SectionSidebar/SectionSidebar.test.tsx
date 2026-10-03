import { render, screen } from 'test/test-utils';

import { SectionSidebar } from './SectionSidebar';
import { SectionSidebarGroup, SectionSidebarItem } from './primitives';
import { type SectionSidebarAction, type SectionSidebarDefinition } from './types';

const context = { sectionId: 'test', pageContext: {} };

function FavoritesGroup() {
  return (
    <SectionSidebarGroup id="favorites" title="Favorites">
      <SectionSidebarItem title="Starred dashboard" url="/d/starred" />
    </SectionSidebarGroup>
  );
}

function createDefinition({ actions = [] }: { actions?: SectionSidebarAction[] } = {}): SectionSidebarDefinition {
  return {
    id: 'test',
    title: 'Test section',
    navIds: [],
    useNewActions: () => ({ actions }),
    search: {
      placeholder: 'Search things',
      useResults: ({ query }) => ({
        items: query ? [{ id: 'r1', title: `Result for ${query}`, url: '/r1' }] : [],
        loading: false,
      }),
    },
    groups: [{ id: 'favorites', title: 'Favorites', Component: FavoritesGroup }],
  };
}

function Harness({ definition }: { definition: SectionSidebarDefinition }) {
  return <SectionSidebar definition={definition} context={context} />;
}

describe('SectionSidebar', () => {
  it('renders the groups until the user searches, then the results', async () => {
    const { user } = render(<Harness definition={createDefinition()} />);

    expect(screen.getByRole('heading', { name: 'Test section' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Starred dashboard' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search things'), 'cpu');

    expect(await screen.findByRole('link', { name: 'Result for cpu' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Starred dashboard' })).not.toBeInTheDocument();
  });

  it('renders a single new action as a button', async () => {
    const onClick = jest.fn();
    const { user } = render(
      <Harness definition={createDefinition({ actions: [{ id: 'one', label: 'New thing', onClick }] })} />
    );

    await user.click(screen.getByRole('button', { name: 'New' }));

    expect(onClick).toHaveBeenCalled();
  });

  it('renders several new actions as a dropdown', async () => {
    const actions = [
      { id: 'a', label: 'New dashboard', url: '/dashboard/new' },
      { id: 'b', label: 'Import', url: '/dashboard/import' },
    ];
    const { user } = render(<Harness definition={createDefinition({ actions })} />);

    await user.click(screen.getByRole('button', { name: 'New' }));

    expect(await screen.findByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import' })).toBeInTheDocument();
  });

  it('hides the new control when there are no actions', () => {
    render(<Harness definition={createDefinition()} />);
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
  });
});
