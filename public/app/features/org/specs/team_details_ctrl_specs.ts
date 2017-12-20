import '../team_details_ctrl';
import {
  describe,
  beforeEach,
  it,
  expect,
  sinon,
  angularMocks,
} from 'test/lib/common';
import TeamDetailsCtrl from '../team_details_ctrl';

describe('TeamDetailsCtrl', () => {
  var ctx: any = {};
  var backendSrv = {
    searchUsers: sinon.stub().returns(Promise.resolve([])),
    get: sinon.stub().returns(Promise.resolve([])),
    post: sinon.stub().returns(Promise.resolve([])),
  };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.controllers'));

  beforeEach(
    angularMocks.inject(($rootScope, $controller, $q) => {
      ctx.$q = $q;
      ctx.scope = $rootScope.$new();
      ctx.ctrl = $controller(TeamDetailsCtrl, {
        $scope: ctx.scope,
        backendSrv: backendSrv,
        $routeParams: { id: 1 },
        navModelSrv: { getNav: sinon.stub() },
      });
    })
  );

  describe('when user is chosen to be added to team', () => {
    beforeEach(() => {
      const userItem = {
        id: 2,
        login: 'user2',
      };
      ctx.ctrl.userPicked(userItem);
    });

    it('should parse the result and save to db', () => {
      expect(backendSrv.post.getCall(0).args[0]).to.eql('/api/teams/1/members');
      expect(backendSrv.post.getCall(0).args[1].userId).to.eql(2);
    });

    it('should refresh the list after saving.', () => {
      expect(backendSrv.get.getCall(0).args[0]).to.eql('/api/teams/1');
      expect(backendSrv.get.getCall(1).args[0]).to.eql('/api/teams/1/members');
    });
  });
});
