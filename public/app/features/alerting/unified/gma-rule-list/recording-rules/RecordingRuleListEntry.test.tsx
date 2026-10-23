import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { FOLDER_PARENTS_URL } from '../mocks/handlers';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';

const server = setupMswServer();

describe('RecordingRuleListEntry', () => {
  it('shows the folder path from the folder parents lookup, root first', async () => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-1', title: 'Team Metrics' },
          ],
        })
      )
    );

    render(
      <ul>
        <RecordingRuleListEntry searchHit={{ uid: 'rule-1', title: 'cpu:usage:rate5m', folderUid: 'folder-1' }} />
      </ul>
    );

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Platform').compareDocumentPosition(screen.getByText('Team Metrics'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
