import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { registerDraftDashboardExtension } from 'app/features/dashboard-scene/saving/enterprise-components/DraftDashboardExtension';

import { initialState } from '../../state/SearchStateManager';

import { ActionRow } from './ActionRow';

function renderActionRow({ draftsOnly = false, onDraftsOnlyChange = jest.fn() } = {}) {
  render(
    <ActionRow
      state={{ ...initialState, draftsOnly }}
      showStarredFilter
      onLayoutChange={jest.fn()}
      onSortChange={jest.fn()}
      onStarredFilterChange={jest.fn()}
      onTagFilterChange={jest.fn()}
      getTagOptions={async () => []}
      getSortOptions={async () => []}
      onDatasourceChange={jest.fn()}
      onPanelTypeChange={jest.fn()}
      onSetIncludePanels={jest.fn()}
      onDraftsOnlyChange={onDraftsOnlyChange}
    />
  );
  return { onDraftsOnlyChange };
}

function registerDraftMode(enabled: boolean) {
  registerDraftDashboardExtension({
    isEnabled: () => enabled,
    getCreateLabels: async () => ({}),
    DraftBadge: () => null,
    SaveAndPublishButton: () => null,
  });
}

describe('ActionRow drafts filter', () => {
  afterEach(() => {
    registerDraftDashboardExtension(null);
  });

  it.each([
    { draftsOnly: false, expected: true },
    { draftsOnly: true, expected: false },
  ])('turns drafts only to $expected when clicked while it is $draftsOnly', async ({ draftsOnly, expected }) => {
    registerDraftMode(true);
    const { onDraftsOnlyChange } = renderActionRow({ draftsOnly });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Drafts' }));

    expect(onDraftsOnlyChange).toHaveBeenCalledWith(expected);
  });

  it('hides the Drafts checkbox when draft mode is off', async () => {
    registerDraftMode(false);
    renderActionRow();

    expect(await screen.findByRole('checkbox', { name: 'Starred' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Drafts' })).not.toBeInTheDocument();
  });
});
