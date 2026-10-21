import { render, screen } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockFullRule, mockRuleSearch } from '../mocks/handlers';
import { createEmptyFilter } from '../rule-search/ruleSearchFilter';

import { RecordingRulesListView } from './RecordingRulesListView';

setupMswServer();

describe('RecordingRulesListView', () => {
  beforeEach(() => {
    setupDataSources();
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    mockFolderParents({ 'folder-1': 'Team Alerts' });
    mockFullRule('recording');
  });

  it('shows the total from the first page as a recording rule count', async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rule-1', 'cpu:avg', 'folder-1')],
      metadata: { totalHits: 2345, totalHitsRelation: 'eq' },
    }));

    render(<RecordingRulesListView filter={createEmptyFilter()} />);

    expect(await screen.findByText('2,345 recording rules')).toBeInTheDocument();
    expect(screen.getByText('cpu:avg')).toBeInTheDocument();
  });
});
