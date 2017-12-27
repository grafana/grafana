import React from 'react';
import renderer from 'react-test-renderer';
import { ServerStats } from './ServerStats';
import { RootStore } from 'app/stores/RootStore';

describe('ServerStats', () => {
  it('Should render table with stats', done => {
    let backendSrvMock = {
      get: jest.fn().mockReturnValue(
        Promise.resolve({
          dashboards: 10,
        })
      ),
    };

    const store = RootStore.create({}, { backendSrv: backendSrvMock });
    const page = renderer.create(<ServerStats store={store} />);

    setTimeout(() => {
      expect(page.toJSON()).toMatchSnapshot();
      done();
    });
  });
});
