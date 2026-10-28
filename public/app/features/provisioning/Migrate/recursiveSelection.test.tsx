import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { resourceKindInfos } from '../utils/resourceKinds';

import { ResourcesToMigrate } from './ResourcesToMigrate';
import { type FolderRow, resourceKey } from './hooks/useMigrationData';

// Users (no resources) > grace (2) > misc (1)
const folders: FolderRow[] = [
  {
    uid: 'grace',
    title: 'grace',
    path: ['Users'],
    parentUid: 'users',
    resourceCount: 2,
    directResources: [
      { uid: 'g1', title: 'grace-1', kind: resourceKindInfos.dashboard },
      { uid: 'g2', title: 'grace-2', kind: resourceKindInfos.dashboard },
    ],
  },
  {
    uid: 'misc',
    title: 'misc',
    path: ['Users', 'grace'],
    parentUid: 'grace',
    resourceCount: 1,
    directResources: [{ uid: 'm1', title: 'misc-1', kind: resourceKindInfos.dashboard }],
  },
];
const containers: FolderRow[] = [{ uid: 'users', title: 'Users', path: [], resourceCount: 0, directResources: [] }];

function Harness() {
  const [uids, setUids] = useState(new Set<string>());
  const [keys, setKeys] = useState(new Set<string>());
  return (
    <>
      <ResourcesToMigrate
        folders={folders}
        containers={containers}
        selectedFolderUids={uids}
        selectedResourceKeys={keys}
        onToggleResource={(key) =>
          setKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
              next.delete(key);
            } else {
              next.add(key);
            }
            return next;
          })
        }
        onSetResourcesSelected={(list, selected) =>
          setKeys((prev) => {
            const next = new Set(prev);
            list.forEach((key) => (selected ? next.add(key) : next.delete(key)));
            return next;
          })
        }
        selectedCount={0}
        allSelected={false}
        onSetFoldersSelected={(list, selected) =>
          setUids((prev) => {
            const next = new Set(prev);
            list.forEach((uid) => (selected ? next.add(uid) : next.delete(uid)));
            return next;
          })
        }
        onMigrateSelected={jest.fn()}
        submitDisabled={false}
        canMigrate
        connectAction={null}
      />
      <output data-testid="folders">{[...uids].sort().join(',')}</output>
      <output data-testid="resources">{[...keys].sort().join(',')}</output>
    </>
  );
}

describe('recursive folder selection', () => {
  it('ticks and unticks a folder together with everything beneath it', async () => {
    const { user } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: /expand users/i }));

    await user.click(screen.getByRole('checkbox', { name: /select folder grace$/i }));
    expect(screen.getByTestId('folders')).toHaveTextContent('grace,misc');

    await user.click(screen.getByRole('checkbox', { name: /select folder grace$/i }));
    expect(screen.getByTestId('folders')).toBeEmptyDOMElement();
  });

  it('ticks and unticks a top-level folder together with everything beneath it', async () => {
    const { user } = render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: /select folder users/i }));
    expect(screen.getByTestId('folders')).toHaveTextContent('grace,misc');

    await user.click(screen.getByRole('checkbox', { name: /select folder users/i }));
    expect(screen.getByTestId('folders')).toBeEmptyDOMElement();
  });

  it('clears resources ticked on their own inside the folders it unticks', async () => {
    const { user } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: /expand users/i }));
    await user.click(screen.getByRole('button', { name: /expand grace$/i }));
    await user.click(screen.getByRole('checkbox', { name: 'grace-1' }));
    expect(screen.getByTestId('resources')).toHaveTextContent(resourceKey(folders[0].directResources[0]));

    await user.click(screen.getByRole('checkbox', { name: /select folder grace$/i }));
    await user.click(screen.getByRole('checkbox', { name: /select folder grace$/i }));

    expect(screen.getByTestId('folders')).toBeEmptyDOMElement();
    expect(screen.getByTestId('resources')).toBeEmptyDOMElement();
  });
});
