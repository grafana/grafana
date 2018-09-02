import React from 'react';
import renderer from 'react-test-renderer';
import { ServerStats } from './ServerStats';
import { initNav } from 'test/mocks/common';
import { ServerStat } from '../apis';

describe('ServerStats', () => {
  it('Should render table with stats', done => {
    const stats: ServerStat[] = [{ name: 'test', value: 'asd' }];

    let getServerStats = () => {
      return Promise.resolve(stats);
    };

    const page = renderer.create(<ServerStats initNav={initNav} getServerStats={getServerStats} />);

    setTimeout(() => {
      expect(page.toJSON()).toMatchSnapshot();
      done();
    });
  });
});
