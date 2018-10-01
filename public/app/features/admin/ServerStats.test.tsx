import React from 'react';
import renderer from 'react-test-renderer';
import { ServerStats } from './ServerStats';
import { createNavModel } from 'test/mocks/common';
import { ServerStat } from './state/apis';

describe('ServerStats', () => {
  it('Should render table with stats', done => {
    const navModel = createNavModel('Admin', 'stats');
    const stats: ServerStat[] = [{ name: 'Total dashboards', value: 10 }, { name: 'Total Users', value: 1 }];

    const getServerStats = () => {
      return Promise.resolve(stats);
    };

    const page = renderer.create(<ServerStats navModel={navModel} getServerStats={getServerStats} />);

    setTimeout(() => {
      expect(page.toJSON()).toMatchSnapshot();
      done();
    });
  });
});
