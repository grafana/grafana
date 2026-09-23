import { waitFor } from '@testing-library/react';

import { locationService } from '@grafana/runtime';
import { NewSceneObjectAddedEvent, SceneObjectBase, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { type ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import * as shareDrawerLoader from '../sharing/ShareDrawer/openShareDrawer';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

describe('DashboardSceneUrlSync', () => {
  describe('Given a standard scene', () => {
    it('Should set UNSAFE_fitPanels when url has autofitpanels', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ autofitpanels: '' });
      const layout = scene.state.body as DefaultGridLayoutManager;

      expect(layout.state.grid.state.UNSAFE_fitPanels).toBe(true);
    });

    it('Should get the autofitpanels from the scene state', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().autofitpanels).toBeUndefined();
      const layout = scene.state.body as DefaultGridLayoutManager;
      layout.state.grid.setState({ UNSAFE_fitPanels: true });
      expect(scene.urlSync?.getUrlState().autofitpanels).toBe('true');
    });
  });

  describe('Scroll to row', () => {
    let scrollIntoViewSpy: jest.Mock;
    let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
    let locationPartialSpy: jest.SpyInstance;

    beforeEach(() => {
      // jsdom doesn't implement scrollIntoView, so patch the prototype rather than spy on it.
      originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      scrollIntoViewSpy = jest.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
      locationPartialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    });

    afterEach(() => {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      locationPartialSpy.mockRestore();
      document.body.innerHTML = '';
    });

    it('scrolls the matching row into view', () => {
      const { scene, element } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ drow: 'Traces-Instance-Stats' });

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(element);
    });

    it('expands a collapsed row', () => {
      const { scene, row } = buildTestSceneWithRow('Traces Instance Stats', { collapse: true });

      scene.urlSync?.updateFromUrl({ drow: 'Traces-Instance-Stats' });

      expect(row.state.collapse).toBe(false);
    });

    it('clears parameter from the url after scrolling so it acts as a one-shot action', () => {
      const { scene } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ drow: 'Traces-Instance-Stats' });

      // replace: true so clearing drow does not push a history entry that Back would restore
      expect(locationPartialSpy).toHaveBeenCalledWith({ drow: null }, true);
    });

    it('expands all collapsed ancestor rows of a nested row', () => {
      const nestedRow = new RowItem({ title: 'Nested' });
      const middleRow = new RowItem({
        title: 'Middle',
        collapse: true,
        layout: new RowsLayoutManager({ rows: [nestedRow] }),
      });
      const outerRow = new RowItem({
        title: 'Outer',
        collapse: true,
        layout: new RowsLayoutManager({ rows: [middleRow] }),
      });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [outerRow] }),
      });

      scene.urlSync?.updateFromUrl({ drow: 'Outer/Middle/Nested' });

      expect(outerRow.state.collapse).toBe(false);
      expect(middleRow.state.collapse).toBe(false);
    });

    it('switches to a non-active tab containing the target row', () => {
      const targetRow = new RowItem({ title: 'Target row' });
      const activeTab = new TabItem({ title: 'Active tab' });
      const targetTab = new TabItem({
        title: 'Target tab',
        layout: new RowsLayoutManager({ rows: [targetRow] }),
      });
      const tabsLayout = new TabsLayoutManager({ tabs: [activeTab, targetTab] });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: tabsLayout,
      });
      tabsLayout.setState({ currentTabSlug: activeTab.getSlug() });

      scene.urlSync?.updateFromUrl({ drow: 'Target-tab/Target-row' });

      expect(tabsLayout.getCurrentTab()).toBe(targetTab);
    });

    it('scrolls the correct row when a nested row shares its slug with a top-level row', () => {
      const nestedRow = new RowItem({ title: 'Row 1' });
      const containerRow = new RowItem({ title: 'Row 2', layout: new RowsLayoutManager({ rows: [nestedRow] }) });
      const topLevelRow = new RowItem({ title: 'Row 1' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [topLevelRow, containerRow] }),
      });

      const topLevelElement = document.createElement('div');
      document.body.appendChild(topLevelElement);
      topLevelRow.containerRef.current = topLevelElement;

      const nestedElement = document.createElement('div');
      document.body.appendChild(nestedElement);
      nestedRow.containerRef.current = nestedElement;

      scene.urlSync?.updateFromUrl({ drow: 'Row-2/Row-1' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(nestedElement);

      scene.urlSync?.updateFromUrl({ drow: 'Row-1' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      expect(scrollIntoViewSpy.mock.instances[1]).toBe(topLevelElement);
    });

    it('distinguishes a row titled with a slash from a nested row with the same path segments', () => {
      const nestedRow = new RowItem({ title: 'Bar' });
      const parentRow = new RowItem({ title: 'Foo', layout: new RowsLayoutManager({ rows: [nestedRow] }) });
      const slashTitleRow = new RowItem({ title: 'Foo/Bar' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [slashTitleRow, parentRow] }),
      });

      const slashTitleElement = document.createElement('div');
      document.body.appendChild(slashTitleElement);
      slashTitleRow.containerRef.current = slashTitleElement;

      const nestedElement = document.createElement('div');
      document.body.appendChild(nestedElement);
      nestedRow.containerRef.current = nestedElement;

      // Encoded slash in the title segment must not match nested Foo/Bar path
      scene.urlSync?.updateFromUrl({ drow: 'Foo%2FBar' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(slashTitleElement);

      scene.urlSync?.updateFromUrl({ drow: 'Foo/Bar' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      expect(scrollIntoViewSpy.mock.instances[1]).toBe(nestedElement);
    });

    it('clears parameter but does not scroll when no row matches the slug', () => {
      const { scene } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ drow: 'Does-Not-Exist' });

      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
      expect(locationPartialSpy).toHaveBeenCalledWith({ drow: null }, true);
    });

    it('matches a repeated row clone by its own slug, without the source row as a path segment', () => {
      const sourceRow = new RowItem({ title: 'Web A' });
      // Repeat clones live in the source row's repeatedRows state, so their scene graph
      // parent is the source row even though they render as its siblings
      const cloneRow = new RowItem({ title: 'Web B', repeatSourceKey: sourceRow.state.key });
      sourceRow.setState({ repeatedRows: [cloneRow] });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [sourceRow] }),
      });

      const cloneElement = document.createElement('div');
      document.body.appendChild(cloneElement);
      cloneRow.containerRef.current = cloneElement;

      scene.urlSync?.updateFromUrl({ drow: 'Web-B' });

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(cloneElement);
    });

    it('scrolls to a repeated row that is created after url sync, when the repeater announces it', () => {
      const sourceRow = new RowItem({ title: 'Web A' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [sourceRow] }),
      });

      // On load the repeat variable has not resolved yet, so the clone does not exist
      scene.urlSync?.updateFromUrl({ drow: 'Web-B' });
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();

      // Simulate the repeater performing repeats: it creates the clones and publishes
      // NewSceneObjectAddedEvent when done
      const cloneRow = new RowItem({ title: 'Web B', repeatSourceKey: sourceRow.state.key });
      sourceRow.setState({ repeatedRows: [cloneRow] });
      const cloneElement = document.createElement('div');
      document.body.appendChild(cloneElement);
      cloneRow.containerRef.current = cloneElement;
      sourceRow.publishEvent(new NewSceneObjectAddedEvent(sourceRow), true);

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(cloneElement);

      // The retry is one-shot: later additions must not scroll again
      sourceRow.publishEvent(new NewSceneObjectAddedEvent(sourceRow), true);
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    });

    it('replaces a pending scroll target when a new drow arrives before the old one matched', () => {
      const sourceRow = new RowItem({ title: 'Web A' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [sourceRow] }),
      });

      scene.urlSync?.updateFromUrl({ drow: 'Web-B' });
      scene.urlSync?.updateFromUrl({ drow: 'Web-C' });

      const cloneB = new RowItem({ title: 'Web B', repeatSourceKey: sourceRow.state.key });
      const cloneC = new RowItem({ title: 'Web C', repeatSourceKey: sourceRow.state.key });
      sourceRow.setState({ repeatedRows: [cloneB, cloneC] });
      for (const clone of [cloneB, cloneC]) {
        const element = document.createElement('div');
        document.body.appendChild(element);
        clone.containerRef.current = element;
      }
      sourceRow.publishEvent(new NewSceneObjectAddedEvent(sourceRow), true);

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(cloneC.containerRef.current);
    });
  });

  describe('entering edit mode', () => {
    it('keeps the URL and selected edit view in sync after successive updates', async () => {
      const scene = buildTestScene();
      scene.setState({
        editable: true,
        isEditing: true,
        meta: { ...scene.state.meta, canEdit: true },
      });

      scene.urlSync?.updateFromUrl({ editview: 'settings' });
      expect(scene.urlSync?.getUrlState().editview).toBe('settings');

      scene.urlSync?.updateFromUrl({ editview: 'variables' });
      expect(scene.urlSync?.getUrlState().editview).toBe('variables');

      await waitFor(() => expect(scene.state.editview?.getUrlKey()).toBe('variables'));
    });

    it('it should be possible to go from the view panel view to the edit view when the dashboard is not in edit mdoe', async () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false });
      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });
      expect(scene.state.viewPanel).toBeDefined();
      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
      // The panel editor is code split, so editPanel lands in a follow-up state update.
      await waitFor(() => expect(scene.state.editPanel).toBeDefined());
      expect(scene.state.viewPanel).toBeUndefined();
    });
  });

  describe('while planning', () => {
    const planning = {
      planId: 'plan-1',
      planTitle: 'Kafka overview',
      onBuild: jest.fn(),
      onDismiss: jest.fn(),
    };

    describe('pending URL loads', () => {
      let scene: DashboardScene;

      beforeEach(() => {
        jest.useFakeTimers();
        scene = buildTestScene();
      });
      afterEach(() => {
        scene.pauseTrackingChanges();
        scene.urlSync!.updateFromUrl({ editview: null, shareView: null, editPanel: null });
        jest.clearAllTimers();
        jest.restoreAllMocks();
        jest.useRealTimers();
      });

      // Settle imports and the zero-delay edit-mode callback without draining recurring dependency timers.
      const settleUrlLoad = () => jest.advanceTimersByTimeAsync(0);

      describe.each([
        { key: 'editview', value: 'settings' },
        { key: 'shareView', value: 'snapshot' },
        { key: 'editPanel', value: '1' },
      ] as const)('$key', ({ key, value }) => {
        function startLoad() {
          scene.setState({ editable: true, isEditing: true, meta: { ...scene.state.meta, canEdit: true } });
          scene.urlSync!.updateFromUrl({ [key]: value });
          expect(scene.urlSync!.getUrlState()[key]).toBe(value);
          expect(scene.state[key]).toBeUndefined();
        }

        it('keeps the URL held until the lazy view opens', async () => {
          startLoad();

          await settleUrlLoad();

          expect(scene.urlSync!.getUrlState()[key]).toBe(value);
          if (key === 'shareView') {
            expect(scene.state.overlay?.state).toMatchObject({ shareView: 'snapshot' });
            expect(scene.state.shareView).toBe('snapshot');
          } else {
            expect(scene.state[key]?.getUrlKey()).toBe(value);
          }
        });

        it('does not reopen a lazy view after its URL parameter is cleared', async () => {
          startLoad();
          scene.urlSync!.updateFromUrl({ [key]: null });

          await settleUrlLoad();

          expect(scene.urlSync!.getUrlState()[key]).toBeUndefined();
          expect(scene.state[key]).toBeUndefined();
          expect(scene.state.overlay).toBeUndefined();
        });

        it.each([false, true])('refuses a pending import when planning starts (resync: %s)', async (resync) => {
          startLoad();
          scene.setState({ planning });
          if (resync) {
            scene.urlSync!.updateFromUrl({ [key]: value });
            expect(scene.urlSync!.getUrlState()[key]).toBeUndefined();
            // A refused request stays cancelled even if planning ends before the import resolves.
            scene.setState({ planning: undefined });
          }

          await settleUrlLoad();

          expect(scene.urlSync!.getUrlState()[key]).toBeUndefined();
          expect(scene.state[key]).toBeUndefined();
          expect(scene.state.overlay).toBeUndefined();
        });
      });

      it.each(['settings', 'unknown-view'])(
        'enters edit mode when %s loads as settings before the edit-mode timer',
        async (editview) => {
          scene.setState({ editable: true, isEditing: false, meta: { ...scene.state.meta, canEdit: true } });
          const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');
          const editviewLoaded = new Promise<void>((resolve) => {
            const subscription = scene.subscribeToState((state) => {
              if (state.editview) {
                subscription.unsubscribe();
                resolve();
              }
            });
          });

          scene.urlSync!.updateFromUrl({ editview });
          expect(scene.urlSync!.getUrlState().editview).toBe(editview);
          expect(scene.state.isEditing).toBe(false);

          await editviewLoaded;

          expect(scene.state.editview?.getUrlKey()).toBe('settings');
          expect(scene.urlSync!.getUrlState().editview).toBe('settings');
          expect(scene.state.isEditing).toBe(false);
          expect(onEnterEditMode).not.toHaveBeenCalled();

          await settleUrlLoad();

          expect(scene.state.isEditing).toBe(true);
          expect(scene.state.editview?.getUrlKey()).toBe('settings');
          expect(onEnterEditMode).toHaveBeenCalledTimes(1);
        }
      );

      it.each(['planning', 'cancel'] as const)(
        'does not enter edit mode after deferred settings entry is superseded by %s',
        async (action) => {
          scene.setState({ editable: true, isEditing: false, meta: { ...scene.state.meta, canEdit: true } });
          const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');
          scene.urlSync!.updateFromUrl({ editview: 'settings' });
          expect(scene.urlSync!.getUrlState().editview).toBe('settings');

          if (action === 'planning') {
            scene.setState({ planning });
          } else {
            scene.urlSync!.updateFromUrl({ editview: null });
          }
          await settleUrlLoad();

          expect(scene.state.isEditing).toBe(false);
          expect(onEnterEditMode).not.toHaveBeenCalled();
          expect(scene.state.editview).toBeUndefined();
          expect(scene.urlSync!.getUrlState().editview).toBeUndefined();
        }
      );

      it.each(['resolve', 'reject'] as const)(
        'opens the newer same-key settings view when the cancelled request settles with %s',
        async (outcome) => {
          const settingsFactory = await import('../settings/createDashboardEditViewFor');
          const viewA = settingsFactory.createDashboardEditViewFor('settings');
          const viewB = settingsFactory.createDashboardEditViewFor('settings');
          const createDashboardEditViewFor = jest
            .spyOn(settingsFactory, 'createDashboardEditViewFor')
            .mockImplementationOnce(() => {
              if (outcome === 'reject') {
                throw new Error('Cancelled settings view creation failed');
              }
              return viewA;
            })
            .mockReturnValueOnce(viewB);
          const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
          scene.setState({ editable: true, isEditing: true, meta: { ...scene.state.meta, canEdit: true } });

          scene.urlSync!.updateFromUrl({ editview: 'settings' });
          expect(scene.urlSync!.getUrlState().editview).toBe('settings');
          expect(scene.state.editview).toBeUndefined();

          scene.urlSync!.updateFromUrl({ editview: null });
          expect(scene.urlSync!.getUrlState().editview).toBeUndefined();

          scene.urlSync!.updateFromUrl({ editview: 'settings' });
          expect(scene.urlSync!.getUrlState().editview).toBe('settings');
          expect(scene.state.editview).toBeUndefined();

          await settleUrlLoad();

          expect(createDashboardEditViewFor).toHaveBeenCalledTimes(2);
          expect(createDashboardEditViewFor).toHaveBeenNthCalledWith(1, 'settings');
          expect(createDashboardEditViewFor).toHaveBeenNthCalledWith(2, 'settings');
          expect(scene.state.editview).toBe(viewB);
          expect(scene.urlSync!.getUrlState().editview).toBe('settings');
          expect(consoleError).not.toHaveBeenCalled();
        }
      );

      describe('share loader requests', () => {
        it('clears the held URL and state and logs the current loader error exactly once', async () => {
          const request = deferred<ShareDrawer>();
          const loadShareDrawer = jest.spyOn(shareDrawerLoader, 'loadShareDrawer').mockReturnValueOnce(request.promise);
          const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
          const error = new Error('Share drawer import failed');

          scene.urlSync!.updateFromUrl({ shareView: 'snapshot' });
          expect(loadShareDrawer).toHaveBeenCalledTimes(1);
          expect(loadShareDrawer).toHaveBeenCalledWith({ shareView: 'snapshot' });
          expect(scene.urlSync!.getUrlState().shareView).toBe('snapshot');
          expect(scene.state.shareView).toBeUndefined();

          request.reject(error);
          await settleUrlLoad();

          expect(scene.urlSync!.getUrlState().shareView).toBeUndefined();
          expect(scene.state.shareView).toBeUndefined();
          expect(scene.state.overlay).toBeUndefined();
          expect(consoleError).toHaveBeenCalledTimes(1);
          expect(consoleError).toHaveBeenCalledWith('Failed to load share drawer', error);
        });

        it('preserves an unrelated overlay when shareView is cleared', () => {
          const overlay = new SceneObjectBase({});
          scene.showModal(overlay);

          scene.urlSync!.updateFromUrl({ shareView: null });

          expect(scene.state.overlay).toBe(overlay);
          expect(scene.state.shareView).toBeUndefined();
          expect(scene.urlSync!.getUrlState().shareView).toBeUndefined();
        });

        describe.each(['resolve', 'reject'] as const)('when a superseded share load settles with %s', (outcome) => {
          it.each(['left open', 'URL cancelled', 'opened then closed'] as const)(
            'preserves the newer overlay state: %s',
            async (action) => {
              const { ShareDrawer } = await import('../sharing/ShareDrawer/ShareDrawer');
              const request = deferred<ShareDrawer>();
              jest.spyOn(shareDrawerLoader, 'loadShareDrawer').mockReturnValueOnce(request.promise);
              const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
              const overlay = new SceneObjectBase({});

              scene.urlSync!.updateFromUrl({ shareView: 'snapshot' });
              expect(scene.urlSync!.getUrlState().shareView).toBe('snapshot');
              expect(scene.state.shareView).toBeUndefined();
              expect(scene.state.overlay).toBeUndefined();

              scene.showModal(overlay);
              expect(scene.state.overlay).toBe(overlay);
              expect(scene.urlSync!.getUrlState().shareView).toBeUndefined();

              if (action === 'URL cancelled') {
                scene.urlSync!.updateFromUrl({ shareView: null });
              } else if (action === 'opened then closed') {
                scene.closeModal();
              }

              if (outcome === 'resolve') {
                request.resolve(new ShareDrawer({ shareView: 'snapshot' }));
              } else {
                request.reject(new Error('Superseded share drawer import failed'));
              }
              await settleUrlLoad();

              expect(scene.state.overlay).toBe(action === 'opened then closed' ? undefined : overlay);
              expect(scene.state.shareView).toBeUndefined();
              expect(scene.urlSync!.getUrlState().shareView).toBeUndefined();
              expect(consoleError).not.toHaveBeenCalled();
            }
          );
        });

        it.each(['resolve', 'reject'] as const)(
          'keeps a newer same-key share request pending when the cancelled request settles with %s',
          async (outcome) => {
            const { ShareDrawer } = await import('../sharing/ShareDrawer/ShareDrawer');
            const requestA = deferred<ShareDrawer>();
            const requestB = deferred<ShareDrawer>();
            const drawerA = new ShareDrawer({ shareView: 'snapshot' });
            const drawerB = new ShareDrawer({ shareView: 'snapshot' });
            const loadShareDrawer = jest
              .spyOn(shareDrawerLoader, 'loadShareDrawer')
              .mockReturnValueOnce(requestA.promise)
              .mockReturnValueOnce(requestB.promise);
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

            scene.urlSync!.updateFromUrl({ shareView: 'snapshot' });
            expect(scene.urlSync!.getUrlState().shareView).toBe('snapshot');
            expect(scene.state.shareView).toBeUndefined();

            scene.urlSync!.updateFromUrl({ shareView: null });
            expect(scene.urlSync!.getUrlState().shareView).toBeUndefined();

            scene.urlSync!.updateFromUrl({ shareView: 'snapshot' });
            expect(loadShareDrawer).toHaveBeenCalledTimes(2);
            expect(loadShareDrawer).toHaveBeenNthCalledWith(1, { shareView: 'snapshot' });
            expect(loadShareDrawer).toHaveBeenNthCalledWith(2, { shareView: 'snapshot' });
            expect(scene.urlSync!.getUrlState().shareView).toBe('snapshot');
            expect(scene.state.shareView).toBeUndefined();
            expect(scene.state.overlay).toBeUndefined();

            if (outcome === 'resolve') {
              requestA.resolve(drawerA);
            } else {
              requestA.reject(new Error('Cancelled share drawer import failed'));
            }
            await settleUrlLoad();

            expect(scene.urlSync!.getUrlState().shareView).toBe('snapshot');
            expect(scene.state.shareView).toBeUndefined();
            expect(scene.state.overlay).toBeUndefined();
            expect(consoleError).not.toHaveBeenCalled();

            requestB.resolve(drawerB);
            await settleUrlLoad();

            expect(scene.state.overlay).toBe(drawerB);
            expect(scene.state.shareView).toBe('snapshot');
            expect(scene.urlSync!.getUrlState().shareView).toBe('snapshot');
            expect(consoleError).not.toHaveBeenCalled();
          }
        );
      });

      it.each([false, true])('refuses a pending library panel when planning starts (resync: %s)', async (resync) => {
        const libPanel = new LibraryPanelBehavior({ name: 'Library panel', uid: 'lib-1' });
        scene.setState({
          isEditing: true,
          body: DefaultGridLayoutManager.fromVizPanels([
            new VizPanel({ key: 'panel-1', pluginId: 'table', $behaviors: [libPanel] }),
          ]),
        });
        scene.urlSync!.updateFromUrl({ editPanel: '1' });
        expect(scene.urlSync!.getUrlState().editPanel).toBe('1');

        scene.setState({ planning });
        if (resync) {
          scene.urlSync!.updateFromUrl({ editPanel: '1' });
          expect(scene.urlSync!.getUrlState().editPanel).toBeUndefined();
          scene.setState({ planning: undefined });
        }
        libPanel.setState({ isLoaded: true });
        await settleUrlLoad();

        expect(scene.state.editPanel).toBeUndefined();
        expect(scene.urlSync!.getUrlState().editPanel).toBeUndefined();
      });
    });

    it('does not open dashboard settings from an editview url param, and does not enter edit mode', () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false, planning });
      jest.spyOn(scene, 'canEditDashboard').mockReturnValue(true);
      const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');

      scene.urlSync?.updateFromUrl({ editview: 'settings' });

      expect(scene.state.editview).toBeUndefined();
      expect(scene.state.isEditing).toBe(false);
      expect(onEnterEditMode).not.toHaveBeenCalled();
    });

    it('does not open the panel editor from an editPanel url param, and does not enter edit mode', () => {
      // Without this guard, the branch below calls onEnterEditMode() directly when not already
      // editing, undoing the invariant the static preview depends on.
      const scene = buildTestScene();
      scene.setState({ isEditing: false, planning });
      const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');

      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });

      expect(scene.state.editPanel).toBeUndefined();
      expect(scene.state.isEditing).toBe(false);
      expect(onEnterEditMode).not.toHaveBeenCalled();
    });

    it('does not open the share drawer from a shareView url param', () => {
      // Share is guarded elsewhere too (keyboard shortcuts; no menu at all on a preview panel)
      // -- this is a third route to the same action.
      const scene = buildTestScene();
      scene.setState({ planning });

      scene.urlSync?.updateFromUrl({ shareView: 'snapshot' });

      expect(scene.state.overlay).toBeUndefined();
      expect(scene.state.shareView).toBeUndefined();
    });

    it('does not open the view-panel pane from a viewPanel url param', () => {
      // Preview panels have no menu, so View isn't reachable that way -- but ?viewPanel= reaches
      // the same pane directly, whose Quick toggles section is plugin-gated, not isPlanning()-gated.
      const scene = buildTestScene();
      scene.setState({ planning });

      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });

      expect(scene.state.viewPanel).toBeUndefined();
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function buildTestSceneWithRow(title: string, { collapse }: { collapse?: boolean } = {}) {
  const row = new RowItem({ title, collapse });
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: new RowsLayoutManager({ rows: [row] }),
  });

  // simulate the row being rendered
  const element = document.createElement('div');
  document.body.appendChild(element);
  row.containerRef.current = element;

  return { scene, row, element };
}

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),

      new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    ]),
  });

  return scene;
}
