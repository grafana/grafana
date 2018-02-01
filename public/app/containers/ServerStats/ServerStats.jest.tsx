import React from 'react';
import renderer from 'react-test-renderer';
import { ServerStats } from './ServerStats';
import { RootStore } from 'app/stores/RootStore/RootStore';
import { backendSrv, createNavTree } from 'test/mocks/common';

describe('ServerStats', () => {
  it('Should render table with stats', done => {
    backendSrv.get.mockReturnValue(
      Promise.resolve({
        dashboards: 10,
      })
    );

    const store = RootStore.create(
      {},
      {
        backendSrv: backendSrv,
        navTree: createNavTree('cfg', 'admin', 'server-stats'),
      }
    );

    const page = renderer.create(<ServerStats backendSrv={backendSrv} {...store} />);

    setTimeout(() => {
      expect(page.toJSON()).toMatchSnapshot();
      done();
    });
  });
});
