import {describe, beforeEach, it, expect, sinon, angularMocks} from 'test/lib/common';
import {AclCtrl} from '../acl';

describe('AclCtrl', () => {
  var ctx: any = {};
  var backendSrv = {
    get: sinon.stub().returns(Promise.resolve([])),
    post: sinon.stub().returns(Promise.resolve([]))
  };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.controllers'));

  beforeEach(angularMocks.inject(($rootScope, $controller, $q, $compile) => {
    ctx.$q = $q;
    ctx.scope = $rootScope.$new();
    AclCtrl.prototype.dashboard = {dashboard: {id: 1}};
    ctx.ctrl = $controller(AclCtrl, {
      $scope: ctx.scope,
      backendSrv: backendSrv,
    }, {
      dashboard: {id: 1}
    });
  }));

  describe('when user permission is to be added', () => {
    beforeEach(done => {
      backendSrv.get.reset();
      backendSrv.post.reset();
      ctx.ctrl.type = 'User';
      ctx.ctrl.userId = 2;
      ctx.ctrl.permission = 1;

      ctx.ctrl.addPermission().then(() => {
        done();
      });
    });

    it('should parse the result and save to db', () => {
      expect(backendSrv.post.getCall(0).args[0]).to.eql('/api/dashboards/id/1/acl');
      expect(backendSrv.post.getCall(0).args[1].userId).to.eql(2);
      expect(backendSrv.post.getCall(0).args[1].permissions).to.eql(1);
    });

    it('should refresh the list after saving.', () => {
      expect(backendSrv.get.getCall(0).args[0]).to.eql('/api/dashboards/id/1/acl');
    });

     it('should reset userId', () => {
      expect(ctx.ctrl.userId).to.eql(null);
    });
  });

  describe('when user group permission is to be added', () => {
    beforeEach(done => {
      backendSrv.get.reset();
      backendSrv.post.reset();
      ctx.ctrl.type = 'User Group';
      ctx.ctrl.userGroupId = 2;
      ctx.ctrl.permission = 1;

      ctx.ctrl.addPermission().then(() => {
        done();
      });
    });

    it('should parse the result and save to db', () => {
      expect(backendSrv.post.getCall(0).args[0]).to.eql('/api/dashboards/id/1/acl');
      expect(backendSrv.post.getCall(0).args[1].userGroupId).to.eql(2);
      expect(backendSrv.post.getCall(0).args[1].permissions).to.eql(1);
    });

    it('should refresh the list after saving.', () => {
      expect(backendSrv.get.getCall(0).args[0]).to.eql('/api/dashboards/id/1/acl');
    });

     it('should reset userGroupId', () => {
      expect(ctx.ctrl.userGroupId).to.eql(null);
    });
  });
});
