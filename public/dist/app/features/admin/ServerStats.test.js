import React from 'react';
import renderer from 'react-test-renderer';
import { ServerStats } from './ServerStats';
import { createNavModel } from 'test/mocks/common';
describe('ServerStats', function () {
    it('Should render table with stats', function (done) {
        var navModel = createNavModel('Admin', 'stats');
        var stats = [{ name: 'Total dashboards', value: 10 }, { name: 'Total Users', value: 1 }];
        var getServerStats = function () {
            return Promise.resolve(stats);
        };
        var page = renderer.create(React.createElement(ServerStats, { navModel: navModel, getServerStats: getServerStats }));
        setTimeout(function () {
            expect(page.toJSON()).toMatchSnapshot();
            done();
        });
    });
});
//# sourceMappingURL=ServerStats.test.js.map