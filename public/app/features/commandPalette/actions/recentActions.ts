import { t } from '@grafana/i18n/internal';
import { getRecentActions } from 'app/core/services/recentActionsSrv';

import { CommandPaletteAction } from '../types';
import { RECENT_PAGES_PRIORITY } from '../values';

// Retrieves a list of recently performed general actions and maps them into
// `CommandPaletteAction` objects for display in the command palette.
export async function getRecentGeneralActions(): Promise<CommandPaletteAction[]> {
  const recent = getRecentActions();

  return recent.map((item) => ({
    id: `recent-action-${item.id}`,
    name: item.title,
    section: t('command-palette.section.recent-actions', 'Recent actions'),
    url: item.url,
    priority: RECENT_PAGES_PRIORITY,
  }));
}
