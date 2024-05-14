import React from 'react';
import { Props } from 'react-virtualized-auto-sizer';

import { EventBusSrv } from '@grafana/data';
import { config } from '@grafana/runtime';

import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';

import { assertQueryLibraryTemplateExists } from './helper/assert';
import { openQueryLibrary } from './helper/interactions';
import { setupExplore, waitForExplore } from './helper/setup';

const reportInteractionMock = jest.fn();
const testEventBus = new EventBusSrv();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: (...args: object[]) => {
    reportInteractionMock(...args);
  },
  getAppEvents: () => testEventBus,
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
    isSignedIn: true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
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

describe('QueryLibrary', () => {
  silenceConsoleOutput();

  beforeAll(() => {
    config.featureToggles.queryLibrary = true;
  });

  afterAll(() => {
    config.featureToggles.queryLibrary = false;
  });

  it('Load query templates', async () => {
    setupExplore();
    await waitForExplore();
    await openQueryLibrary();
    await assertQueryLibraryTemplateExists('loki', 'Loki Query Template');
    await assertQueryLibraryTemplateExists('elastic', 'Elastic Query Template');
  });
});
