import { getPanelEditorTabs } from './selectors';
import { LocationState } from 'app/types';
import { PanelPlugin } from '@grafana/data';
import { PanelEditorTabId } from '../types';
import { updateConfig } from '../../../../../core/config';

describe('getPanelEditorTabs selector', () => {
  it('return no tabs when no plugin provided', () => {
    expect(getPanelEditorTabs({} as LocationState)).toEqual([]);
  });

  it('return no tabs when plugin do not support queries', () => {
    expect(getPanelEditorTabs({} as LocationState, { meta: { skipDataQuery: true } } as PanelPlugin)).toEqual([]);
  });

  describe('alerts tab', () => {
    describe('when alerting enabled', () => {
      beforeAll(() => {
        updateConfig({
          alertingEnabled: true,
        });
      });

      it('returns Alerts tab for graph panel', () => {
        const tabs = getPanelEditorTabs(
          { query: {} } as LocationState,
          {
            meta: {
              id: 'graph',
            },
          } as PanelPlugin
        );

        expect(tabs.length).toEqual(3);
        expect(tabs[2].id).toEqual(PanelEditorTabId.Alert);
      });

      it('does not returns tab for panel other than graph', () => {
        const tabs = getPanelEditorTabs(
          { query: {} } as LocationState,
          {
            meta: {
              id: 'table',
            },
          } as PanelPlugin
        );
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
        const tabs = getPanelEditorTabs(
          { query: {} } as LocationState,
          {
            meta: {
              id: 'graph',
            },
          } as PanelPlugin
        );

        expect(tabs.length).toEqual(2);
        expect(tabs[1].id).toEqual(PanelEditorTabId.Transform);
      });
    });
  });
});
