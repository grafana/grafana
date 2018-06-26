import '../team_details_ctrl';
import TeamDetailsCtrl from '../team_details_ctrl';

describe('TeamDetailsCtrl', () => {
  var backendSrv = {
    searchUsers: jest.fn(() => Promise.resolve([])),
    get: jest.fn(() => Promise.resolve([])),
    post: jest.fn(() => Promise.resolve([])),
  };

  //Team id
  var routeParams = {
    id: 1,
  };

  var navModelSrv = {
    getNav: jest.fn(),
  };

  var teamDetailsCtrl = new TeamDetailsCtrl({ $broadcast: jest.fn() }, backendSrv, routeParams, navModelSrv);

  describe('when user is chosen to be added to team', () => {
    beforeEach(() => {
      teamDetailsCtrl = new TeamDetailsCtrl({ $broadcast: jest.fn() }, backendSrv, routeParams, navModelSrv);
      const userItem = {
        id: 2,
        login: 'user2',
      };
      teamDetailsCtrl.userPicked(userItem);
    });

    it('should parse the result and save to db', () => {
      expect(backendSrv.post.mock.calls[0][0]).toBe('/api/teams/1/members');
      expect(backendSrv.post.mock.calls[0][1].userId).toBe(2);
    });

    it('should refresh the list after saving.', () => {
      expect(backendSrv.get.mock.calls[0][0]).toBe('/api/teams/1');
      expect(backendSrv.get.mock.calls[1][0]).toBe('/api/teams/1/members');
    });
  });
});
