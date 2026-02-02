import { t } from 'app/core/internationalization';
import { BMCTeamsState } from 'app/types';

export const getTeamsSearchQuery = (state: BMCTeamsState) => state.searchQuery;

export const getTeamFilters = () => {
  return {
    all: { label: t('bmc.rbac.common.all', 'All'), value: 'All' },
    assigned: { label: t('bmc.rbac.common.assigned', 'Assigned'), value: 'Assigned' },
  };
};
