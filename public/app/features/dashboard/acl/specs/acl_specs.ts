import {
  describe,
  beforeEach,
  it,
  expect,
  sinon,
  angularMocks,
} from 'test/lib/common';
import { AclCtrl } from '../acl';

describe('AclCtrl', () => {
  const ctx: any = {};
  const backendSrv = {
    get: sinon.stub().returns(Promise.resolve([])),
    post: sinon.stub().returns(Promise.resolve([])),
  };

  const dashboardSrv = {
    getCurrent: sinon.stub().returns({ id: 1, meta: { isFolder: false } }),
  };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.controllers'));

  beforeEach(
    angularMocks.inject(($rootScope, $controller, $q, $compile) => {
      ctx.$q = $q;
      ctx.scope = $rootScope.$new();
      AclCtrl.prototype.dashboard = { dashboard: { id: 1 } };
      ctx.ctrl = $controller(
        AclCtrl,
        {
          $scope: ctx.scope,
          backendSrv: backendSrv,
          dashboardSrv: dashboardSrv,
        },
        {
          dismiss: () => {
            return;
          },
        }
      );
    })
  );

  describe('when permissions are added', () => {
    beforeEach(() => {
      backendSrv.get.reset();
      backendSrv.post.reset();

      const userItem = {
        id: 2,
        login: 'user2',
      };

      ctx.ctrl.userPicked(userItem);

      const teamItem = {
        id: 2,
        name: 'ug1',
      };

      ctx.ctrl.groupPicked(teamItem);

      ctx.ctrl.newType = 'Editor';
      ctx.ctrl.typeChanged();

      ctx.ctrl.newType = 'Viewer';
      ctx.ctrl.typeChanged();
    });

    it('should sort the result by role, team and user', () => {
      expect(ctx.ctrl.items[0].role).to.eql('Viewer');
      expect(ctx.ctrl.items[1].role).to.eql('Editor');
      expect(ctx.ctrl.items[2].teamId).to.eql(2);
      expect(ctx.ctrl.items[3].userId).to.eql(2);
    });

    it('should save permissions to db', done => {
      ctx.ctrl.update().then(() => {
        done();
      });

      expect(backendSrv.post.getCall(0).args[0]).to.eql(
        '/api/dashboards/id/1/acl'
      );
      expect(backendSrv.post.getCall(0).args[1].items[0].role).to.eql('Viewer');
      expect(backendSrv.post.getCall(0).args[1].items[0].permission).to.eql(1);
      expect(backendSrv.post.getCall(0).args[1].items[1].role).to.eql('Editor');
      expect(backendSrv.post.getCall(0).args[1].items[1].permission).to.eql(1);
      expect(backendSrv.post.getCall(0).args[1].items[2].teamId).to.eql(2);
      expect(backendSrv.post.getCall(0).args[1].items[2].permission).to.eql(1);
      expect(backendSrv.post.getCall(0).args[1].items[3].userId).to.eql(2);
      expect(backendSrv.post.getCall(0).args[1].items[3].permission).to.eql(1);
    });
  });

  describe('when duplicate role permissions are added', () => {
    beforeEach(() => {
      backendSrv.get.reset();
      backendSrv.post.reset();
      ctx.ctrl.items = [];

      ctx.ctrl.newType = 'Editor';
      ctx.ctrl.typeChanged();

      ctx.ctrl.newType = 'Editor';
      ctx.ctrl.typeChanged();
    });

    it('should throw a validation error', () => {
      expect(ctx.ctrl.error).to.eql(ctx.ctrl.duplicateError);
    });

    it('should not add the duplicate permission', () => {
      expect(ctx.ctrl.items.length).to.eql(1);
    });
  });

  describe('when duplicate user permissions are added', () => {
    beforeEach(() => {
      backendSrv.get.reset();
      backendSrv.post.reset();
      ctx.ctrl.items = [];

      const userItem = {
        id: 2,
        login: 'user2',
      };

      ctx.ctrl.userPicked(userItem);
      ctx.ctrl.userPicked(userItem);
    });

    it('should throw a validation error', () => {
      expect(ctx.ctrl.error).to.eql(ctx.ctrl.duplicateError);
    });

    it('should not add the duplicate permission', () => {
      expect(ctx.ctrl.items.length).to.eql(1);
    });
  });

  describe('when duplicate team permissions are added', () => {
    beforeEach(() => {
      backendSrv.get.reset();
      backendSrv.post.reset();
      ctx.ctrl.items = [];

      const teamItem = {
        id: 2,
        name: 'ug1',
      };

      ctx.ctrl.groupPicked(teamItem);
      ctx.ctrl.groupPicked(teamItem);
    });

    it('should throw a validation error', () => {
      expect(ctx.ctrl.error).to.eql(ctx.ctrl.duplicateError);
    });

    it('should not add the duplicate permission', () => {
      expect(ctx.ctrl.items.length).to.eql(1);
    });
  });

  describe('when one inherited and one not inherited team permission are added', () => {
    beforeEach(() => {
      backendSrv.get.reset();
      backendSrv.post.reset();
      ctx.ctrl.items = [];

      const inheritedTeamItem = {
        id: 2,
        name: 'ug1',
        dashboardId: -1,
      };

      ctx.ctrl.items.push(inheritedTeamItem);

      const teamItem = {
        id: 2,
        name: 'ug1',
      };
      ctx.ctrl.groupPicked(teamItem);
    });

    it('should not throw a validation error', () => {
      expect(ctx.ctrl.error).to.eql('');
    });

    it('should add both permissions', () => {
      expect(ctx.ctrl.items.length).to.eql(2);
    });
  });
});
