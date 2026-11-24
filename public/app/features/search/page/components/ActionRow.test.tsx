import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DraftDashboardExtension,
  registerDraftDashboardExtension,
} from 'app/features/dashboard-scene/saving/enterprise-components/DraftDashboardExtension';

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

function registerDraftMode(enabled: boolean, extra: Partial<DraftDashboardExtension> = {}) {
  registerDraftDashboardExtension({
    isEnabled: () => enabled,
    getCreateLabels: async () => ({}),
    DraftBadge: () => null,
    SaveAndPublishButton: () => null,
    ...extra,
  });
}

// A control that flips draft mode, like the Enterprise "Draft settings" popover
function registerToggleableDraftMode(initial: boolean) {
  let enabled = initial;
  registerDraftMode(false, {
    isEnabled: () => enabled,
    DraftModeControl: ({ onChange }) => (
      <button
        onClick={() => {
          enabled = !enabled;
          onChange();
        }}
      >
        Draft settings
      </button>
    ),
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

  describe('draft mode control', () => {
    it('is shown while draft mode is off, so it can be turned on', async () => {
      registerToggleableDraftMode(false);
      renderActionRow();

      expect(await screen.findByRole('button', { name: 'Draft settings' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Drafts' })).not.toBeInTheDocument();
    });

    it('shows the Drafts checkbox as soon as the control turns draft mode on', async () => {
      registerToggleableDraftMode(false);
      renderActionRow();

      await userEvent.click(screen.getByRole('button', { name: 'Draft settings' }));

      expect(screen.getByRole('checkbox', { name: 'Drafts' })).toBeInTheDocument();
    });

    it('clears an active drafts filter when the control turns draft mode off', async () => {
      registerToggleableDraftMode(true);
      const { onDraftsOnlyChange } = renderActionRow({ draftsOnly: true });

      await userEvent.click(screen.getByRole('button', { name: 'Draft settings' }));

      expect(onDraftsOnlyChange).toHaveBeenCalledWith(false);
      expect(screen.queryByRole('checkbox', { name: 'Drafts' })).not.toBeInTheDocument();
    });

    it('is not shown where the list has no drafts filter', async () => {
      registerToggleableDraftMode(true);
      render(
        <ActionRow
          state={initialState}
          showStarredFilter
          onLayoutChange={jest.fn()}
          onSortChange={jest.fn()}
          onTagFilterChange={jest.fn()}
          getTagOptions={async () => []}
          getSortOptions={async () => []}
          onDatasourceChange={jest.fn()}
          onPanelTypeChange={jest.fn()}
          onSetIncludePanels={jest.fn()}
        />
      );

      expect(await screen.findByRole('checkbox', { name: 'Starred' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Draft settings' })).not.toBeInTheDocument();
    });
  });
});
