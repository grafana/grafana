import React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { UnConnectedExploreToolbar } from './ExploreToolbar';
import { ExploreMode } from '@grafana/data';
import { ExploreId } from '../../types';
import { ToggleButtonGroup } from '@grafana/ui';

jest.mock('./state/selectors', () => {
  return {
    __esModule: true,
    getExploreDatasources: () => [] as any,
  };
});

describe('ExploreToolbar', () => {
  it('displays correct modes', () => {
    let wrapper = shallow(createToolbar([ExploreMode.Tracing, ExploreMode.Logs]));
    checkModes(wrapper, ['Logs', 'Tracing']);

    wrapper = shallow(createToolbar([ExploreMode.Logs]));
    checkModes(wrapper, []);

    wrapper = shallow(createToolbar([ExploreMode.Logs, ExploreMode.Tracing, ExploreMode.Metrics]));
    checkModes(wrapper, ['Metrics', 'Logs', 'Tracing']);
  });
});

function checkModes(wrapper: ShallowWrapper, modes: string[]) {
  expect(
    wrapper
      .find(ToggleButtonGroup)
      .children()
      .map(node => node.children().text())
  ).toEqual(modes);
}

function createToolbar(supportedModes: ExploreMode[]) {
  return (
    <UnConnectedExploreToolbar
      datasourceMissing={false}
      loading={false}
      range={{} as any}
      timeZone={'UTC'}
      splitted={false}
      syncedTimes={false}
      supportedModes={supportedModes}
      selectedMode={ExploreMode.Tracing}
      hasLiveOption={false}
      isLive={false}
      isPaused={false}
      queries={[]}
      containerWidth={0}
      changeDatasource={(() => {}) as any}
      clearAll={(() => {}) as any}
      cancelQueries={(() => {}) as any}
      runQueries={(() => {}) as any}
      closeSplit={(() => {}) as any}
      split={(() => {}) as any}
      syncTimes={(() => {}) as any}
      changeRefreshInterval={(() => {}) as any}
      changeMode={(() => {}) as any}
      updateLocation={(() => {}) as any}
      setDashboardQueriesToUpdateOnLoad={(() => {}) as any}
      exploreId={ExploreId.left}
      onChangeTime={(() => {}) as any}
      onChangeTimeZone={(() => {}) as any}
    />
  );
}
