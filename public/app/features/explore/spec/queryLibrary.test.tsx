import { Props } from 'react-virtualized-auto-sizer';

import { EventBusSrv } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema/dist/esm/veneer/common.types';

import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';

import {
  assertAddToQueryLibraryButtonExists,
  assertQueryHistory,
  assertQueryLibraryTemplateExists,
} from './helper/assert';
import {
  addQueryHistoryToQueryLibrary,
  openQueryHistory,
  openQueryLibrary,
  submitAddToQueryLibrary,
  switchToQueryHistory,
} from './helper/interactions';
import { setupExplore, waitForExplore } from './helper/setup';

const reportInteractionMock = jest.fn();
const testEventBus = new EventBusSrv();
testEventBus.publish = jest.fn();

interface MockQuery extends DataQuery {
  expr: string;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: (...args: object[]) => {
    reportInteractionMock(...args);
  },
  getAppEvents: () => testEventBus,
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
    isSignedIn: true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
    user: {
      isSignedIn: true,
    },
  },
}));

jest.mock('app/core/services/PreferencesService', () => ({
  PreferencesService: function () {
    return {
      patch: jest.fn(),
      load: jest.fn().mockResolvedValue({
        queryHistory: {
          homeTab: 'query',
        },
      }),
    };
  },
}));

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: Props) {
      return <div>{props.children({ height: 1, scaledHeight: 1, scaledWidth: 1000, width: 1000 })}</div>;
    },
  };
});

function setupQueryLibrary() {
  const mockQuery: MockQuery = { refId: 'TEST', expr: 'TEST' };
  setupExplore({
    queryHistory: {
      queryHistory: [{ datasourceUid: 'loki', queries: [mockQuery] }],
      totalCount: 1,
    },
    withAppChrome: true,
  });
}

let previousQueryLibraryEnabled: boolean | undefined;
let previousQueryHistoryEnabled: boolean;

describe('QueryLibrary', () => {
  silenceConsoleOutput();

  beforeAll(() => {
    previousQueryLibraryEnabled = config.featureToggles.queryLibrary;
    previousQueryHistoryEnabled = config.queryHistoryEnabled;

    config.featureToggles.queryLibrary = true;
    config.queryHistoryEnabled = true;
  });

  afterAll(() => {
    config.featureToggles.queryLibrary = previousQueryLibraryEnabled;
    config.queryHistoryEnabled = previousQueryHistoryEnabled;
    jest.restoreAllMocks();
  });

  it('Load query templates', async () => {
    setupQueryLibrary();
    await waitForExplore();
    await openQueryLibrary();
    await assertQueryLibraryTemplateExists('loki', 'Loki Query Template');
  });

  it('Shows add to query library button only when the toggle is enabled', async () => {
    setupQueryLibrary();
    await waitForExplore();
    await openQueryLibrary();
    await switchToQueryHistory();
    await assertQueryHistory(['{"expr":"TEST"}']);
    await assertAddToQueryLibraryButtonExists(true);
  });

  it('Does not show the query library button when the toggle is disabled', async () => {
    config.featureToggles.queryLibrary = false;
    setupQueryLibrary();
    await waitForExplore();
    await openQueryHistory();
    await assertQueryHistory(['{"expr":"TEST"}']);
    await assertAddToQueryLibraryButtonExists(false);
    config.featureToggles.queryLibrary = true;
  });

  it('Shows a notification when a template is added and hides the add button', async () => {
    setupQueryLibrary();
    await waitForExplore();
    await openQueryLibrary();
    await switchToQueryHistory();
    await assertQueryHistory(['{"expr":"TEST"}']);
    await addQueryHistoryToQueryLibrary();
    await submitAddToQueryLibrary({ description: 'Test' });
    expect(testEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alert-success',
        payload: ['Query successfully saved to the library'],
      })
    );
    await assertAddToQueryLibraryButtonExists(false);
  });
});
