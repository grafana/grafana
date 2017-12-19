import { AclCtrl } from "../acl";

describe("AclCtrl", () => {
  const backendSrv = {
    getDashboard: jest.fn(() =>
      Promise.resolve({ id: 1, meta: { isFolder: false } })
    ),
    get: jest.fn(() => Promise.resolve([])),
    post: jest.fn(() => Promise.resolve([]))
  };

  let ctrl;
  let backendSrvPostMock;

  beforeEach(() => {
    AclCtrl.prototype.dashboard = { id: 1 };
    AclCtrl.prototype.meta = { isFolder: false };

    ctrl = new AclCtrl(
      backendSrv,
      { trustAsHtml: t => t },
      { $broadcast: () => {} }
    );
    backendSrvPostMock = backendSrv.post as any;
  });

  describe("when permissions are added", () => {
    beforeEach(() => {
      const userItem = {
        id: 2,
        login: "user2"
      };

      ctrl.userPicked(userItem);

      const teamItem = {
        id: 2,
        name: "ug1"
      };

      ctrl.groupPicked(teamItem);

      ctrl.newType = "Editor";
      ctrl.typeChanged();

      ctrl.newType = "Viewer";
      ctrl.typeChanged();

      return ctrl.update();
    });

    it("should sort the result by role, team and user", () => {
      expect(ctrl.items[0].role).toBe("Viewer");
      expect(ctrl.items[1].role).toBe("Editor");
      expect(ctrl.items[2].teamId).toBe(2);
      expect(ctrl.items[3].userId).toBe(2);
    });

    it("should save permissions to db", () => {
      expect(backendSrvPostMock.mock.calls[0][0]).toBe(
        "/api/dashboards/id/1/acl"
      );
      expect(backendSrvPostMock.mock.calls[0][1].items[0].role).toBe("Viewer");
      expect(backendSrvPostMock.mock.calls[0][1].items[0].permission).toBe(1);
      expect(backendSrvPostMock.mock.calls[0][1].items[1].role).toBe("Editor");
      expect(backendSrvPostMock.mock.calls[0][1].items[1].permission).toBe(1);
      expect(backendSrvPostMock.mock.calls[0][1].items[2].teamId).toBe(2);
      expect(backendSrvPostMock.mock.calls[0][1].items[2].permission).toBe(1);
      expect(backendSrvPostMock.mock.calls[0][1].items[3].userId).toBe(2);
      expect(backendSrvPostMock.mock.calls[0][1].items[3].permission).toBe(1);
    });
  });

  describe("when duplicate role permissions are added", () => {
    beforeEach(() => {
      ctrl.items = [];

      ctrl.newType = "Editor";
      ctrl.typeChanged();

      ctrl.newType = "Editor";
      ctrl.typeChanged();
    });

    it("should throw a validation error", () => {
      expect(ctrl.error).toBe(ctrl.duplicateError);
    });

    it("should not add the duplicate permission", () => {
      expect(ctrl.items.length).toBe(1);
    });
  });

  describe("when duplicate user permissions are added", () => {
    beforeEach(() => {
      ctrl.items = [];

      const userItem = {
        id: 2,
        login: "user2"
      };

      ctrl.userPicked(userItem);
      ctrl.userPicked(userItem);
    });

    it("should throw a validation error", () => {
      expect(ctrl.error).toBe(ctrl.duplicateError);
    });

    it("should not add the duplicate permission", () => {
      expect(ctrl.items.length).toBe(1);
    });
  });

  describe("when duplicate team permissions are added", () => {
    beforeEach(() => {
      ctrl.items = [];

      const teamItem = {
        id: 2,
        name: "ug1"
      };

      ctrl.groupPicked(teamItem);
      ctrl.groupPicked(teamItem);
    });

    it("should throw a validation error", () => {
      expect(ctrl.error).toBe(ctrl.duplicateError);
    });

    it("should not add the duplicate permission", () => {
      expect(ctrl.items.length).toBe(1);
    });
  });

  describe("when one inherited and one not inherited team permission are added", () => {
    beforeEach(() => {
      ctrl.items = [];

      const inheritedTeamItem = {
        id: 2,
        name: "ug1",
        dashboardId: -1
      };

      ctrl.items.push(inheritedTeamItem);

      const teamItem = {
        id: 2,
        name: "ug1"
      };
      ctrl.groupPicked(teamItem);
    });

    it("should not throw a validation error", () => {
      expect(ctrl.error).toBe("");
    });

    it("should add both permissions", () => {
      expect(ctrl.items.length).toBe(2);
    });
  });

  afterEach(() => {
    backendSrvPostMock.mockClear();
  });
});
