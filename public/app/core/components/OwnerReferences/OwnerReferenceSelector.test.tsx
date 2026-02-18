import { render } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';

import { backendSrv } from '../../services/backend_srv';

import { OwnerReferenceSelector } from './OwnerReferenceSelector';

setBackendSrv(backendSrv);
setupMockServer();

describe('OwnerReferenceSelector', () => {
  it('shows load error but keeps selector interactive', async () => {
    const { getByRole, findByText } = render(<OwnerReferenceSelector onChange={jest.fn()} defaultTeamUid="team-a" />);

    expect(getByRole('combobox')).toBeInTheDocument();
    expect(await findByText('Could not load team details')).toBeInTheDocument();
  });
});
