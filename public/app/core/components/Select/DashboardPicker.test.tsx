import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import * as dashboardApi from 'app/features/dashboard/api/dashboard_api';

import { DashboardPicker } from './DashboardPicker';

setBackendSrv(backendSrv);
setupMockServer();

const [_, { folderA, folderA_dashbdD }] = getFolderFixtures();

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('DashboardPicker', () => {
  describe('using app platform', () => {
    const onChange = jest.fn();

    testWithFeatureToggles({ enable: [] });

    it('should fetch and display dashboards', async () => {
      render(<DashboardPicker value={folderA_dashbdD.item.uid} />);

      expect(await screen.findByText(`${folderA.item.title}/${folderA_dashbdD.item.title}`)).toBeInTheDocument();
    });

    it('should search for dashboards and allow selection', async () => {
      const { user } = render(<DashboardPicker onChange={onChange} />);

      const expectedDash = folderA_dashbdD.item;
      const expectedFolder = folderA.item;

      await user.type(screen.getByRole('combobox'), expectedDash.title);

      expect(await screen.findByText(`${expectedFolder.title}/${expectedDash.title}`)).toBeInTheDocument();

      await user.click(screen.getByText(`${expectedFolder.title}/${expectedDash.title}`));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          folderTitle: expectedFolder.title,
          folderUid: expectedFolder.uid,
          name: expectedDash.title,
          uid: expectedDash.uid,
        })
      );
    });

    it('should render an unknown current value that can be cleared when clearable', async () => {
      const onChange = jest.fn();
      const { user } = render(
        <DashboardPicker value="unknown-dashboard-uid" isClearable onChange={onChange} showUnknown />
      );

      await screen.findByText('Unknown dashboard (unknown-dashboard-uid)');
      await user.click(await screen.findByRole('button', { name: 'Clear value' }));

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('should ignore stale unknown fallback when value changes to another dashboard', async () => {
      const unknownUid = 'deleted-dashboard-uid';
      const pendingUnknown = createDeferred<never>();
      const getDashboardDTO = jest
        .fn()
        .mockImplementationOnce(() => pendingUnknown.promise)
        .mockResolvedValueOnce({
          dashboard: { uid: folderA_dashbdD.item.uid, title: folderA_dashbdD.item.title },
          meta: { folderTitle: folderA.item.title, folderUid: folderA.item.uid },
        });
      const apiSpy = jest
        .spyOn(dashboardApi, 'getDashboardAPI')
        .mockResolvedValue({ getDashboardDTO } as unknown as Awaited<ReturnType<typeof dashboardApi.getDashboardAPI>>);

      const { rerender } = render(<DashboardPicker value={unknownUid} showUnknown />);

      rerender(<DashboardPicker value={folderA_dashbdD.item.uid} showUnknown />);

      expect(await screen.findByText(`${folderA.item.title}/${folderA_dashbdD.item.title}`)).toBeInTheDocument();

      pendingUnknown.reject(new Error('not found'));

      await waitFor(() => {
        expect(screen.queryByText(`Unknown dashboard (${unknownUid})`)).not.toBeInTheDocument();
      });

      apiSpy.mockRestore();
    });
  });

  xdescribe('dashboard v2 (v2beta1 API)', () => {
    testWithFeatureToggles({ enable: ['dashboardNewLayouts'] });
    it('renders dashboard correctly', async () => {
      render(<DashboardPicker value="v2-special-case-override" />);
      expect(await screen.findByText('TODO')).toBeInTheDocument();
    });
  });
});
