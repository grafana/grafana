import { PanelPlugin } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { updateConfig } from '../../../../../core/config';
import { PanelEditorTabId } from '../types';

import { getPanelEditorTabs } from './selectors';

jest.mock('app/core/services/context_srv');

const mocks = {
  contextSrv: jest.mocked(contextSrv),
};

describe('getPanelEditorTabs selector', () => {
  it('return no tabs when no plugin provided', () => {
    expect(getPanelEditorTabs()).toEqual([]);
  });

  it('return no tabs when plugin do not support queries', () => {
    expect(getPanelEditorTabs(undefined, { meta: { skipDataQuery: true } } as PanelPlugin)).toEqual([]);
  });

  it('marks tab as active when tab param provided', () => {
    expect(getPanelEditorTabs('transform', { meta: { skipDataQuery: false } } as PanelPlugin)).toMatchInlineSnapshot(`
      [
        {
          "active": false,
          "icon": "database",
          "id": "query",
          "text": "Query",
        },
        {
          "active": true,
          "icon": "process",
          "id": "transform",
          "text": "Transform",
        },
      ]
    `);
  });

  describe('alerts tab', () => {
    describe('when alerting enabled', () => {
      beforeAll(() => {
        updateConfig({
          alertingEnabled: true,
        });
      });

      it('returns Alerts tab for graph panel', () => {
        const tabs = getPanelEditorTabs(undefined, {
          meta: {
            id: 'graph',
          },
        } as PanelPlugin);

        expect(tabs.length).toEqual(3);
        expect(tabs[2].id).toEqual(PanelEditorTabId.Alert);
      });

      it('does not returns tab for panel other than graph', () => {
        const tabs = getPanelEditorTabs(undefined, {
          meta: {
            id: 'table',
          },
        } as PanelPlugin);
        expect(tabs.length).toEqual(2);
        expect(tabs[1].id).toEqual(PanelEditorTabId.Transform);
      });
    });

    describe('when alerting disabled', () => {
      beforeAll(() => {
        updateConfig({
          alertingEnabled: false,
        });
      });

      it('does not return Alerts tab', () => {
        const tabs = getPanelEditorTabs(undefined, {
          meta: {
            id: 'graph',
          },
        } as PanelPlugin);

        expect(tabs.length).toEqual(2);
        expect(tabs[1].id).toEqual(PanelEditorTabId.Transform);
      });
    });

    describe('with unified alerting enabled', () => {
      beforeAll(() => {
        updateConfig({ unifiedAlertingEnabled: true });
      });

      it('shows the alert tab for users with read permission', () => {
        mocks.contextSrv.hasPermission.mockReturnValue(true);

        const tabs = getPanelEditorTabs(undefined, {
          meta: {
            id: 'graph',
          },
        } as PanelPlugin);

        expect(tabs.length).toEqual(3);
        expect(tabs[2].id).toEqual(PanelEditorTabId.Alert);
      });

      it('hides the alert tab for users with read permission', () => {
        mocks.contextSrv.hasPermission.mockReturnValue(false);

        const tabs = getPanelEditorTabs(undefined, {
          meta: {
            id: 'graph',
          },
        } as PanelPlugin);

        expect(tabs.length).toEqual(2);
        expect(tabs[1].id).toEqual(PanelEditorTabId.Transform);
      });
    });
  });
});
