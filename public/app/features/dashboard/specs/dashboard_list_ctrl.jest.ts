import {DashboardListCtrl} from '../dashboard_list_ctrl';
import q from 'q';

describe('DashboardListCtrl', () => {
  describe('when fetching dashboards', () => {
    let ctrl;

    describe('and dashboard has parent that is not in search result', () => {
      beforeEach(() => {
        const response = [
          {
            id: 399,
            title: "Dashboard Test",
            uri: "db/dashboard-test",
            type: "dash-db",
            tags: [],
            isStarred: false,
            folderId: 410,
            folderTitle: "afolder",
            folderSlug: "afolder"
          }
        ];

        ctrl = new DashboardListCtrl({get: () => q.resolve(response)}, {getNav: () => {}}, q);
        return ctrl.getDashboards();
      });

      it('should add the missing parent folder to the result', () => {
        expect(ctrl.dashboards.length).toEqual(2);
        expect(ctrl.dashboards[0].id).toEqual(410);
        expect(ctrl.dashboards[1].id).toEqual(399);
      });
    });

    beforeEach(() => {
      const response = [
        {
          id: 410,
          title: "afolder",
          uri: "db/afolder",
          type: "dash-folder",
          tags: [],
          isStarred: false
        },
        {
          id: 3,
          title: "something else",
          uri: "db/something-else",
          type: "dash-db",
          tags: [],
          isStarred: false,
        },
        {
          id: 399,
          title: "Dashboard Test",
          uri: "db/dashboard-test",
          type: "dash-db",
          tags: [],
          isStarred: false,
          folderId: 410,
          folderTitle: "afolder",
          folderSlug: "afolder"
        }
      ];
      ctrl = new DashboardListCtrl({get: () => q.resolve(response)}, {getNav: () => {}}, null);
      return ctrl.getDashboards();
    });

    it('should group them in folders', () => {
      expect(ctrl.dashboards.length).toEqual(3);
      expect(ctrl.dashboards[0].id).toEqual(410);
      expect(ctrl.dashboards[1].id).toEqual(399);
      expect(ctrl.dashboards[2].id).toEqual(3);
    });
  });

  describe('when selecting dashboards', () => {
    let ctrl;

    beforeEach(() => {
      ctrl = new DashboardListCtrl({get: () => q.resolve([])}, {getNav: () => {}}, null);
    });

    describe('and no dashboards are selected', () => {
      beforeEach(() => {
        ctrl.dashboards = [
          {id: 1, type: 'dash-folder'},
          {id: 2, type: 'dash-db'}
        ];
        ctrl.selectionChanged();
      });

      it('should disable Move To button', () => {
        expect(ctrl.canMove).toBeFalsy();
      });

      it('should disable delete button', () => {
        expect(ctrl.canDelete).toBeFalsy();
      });
    });

    describe('and one dashboard in root is selected', () => {
      beforeEach(() => {
        ctrl.dashboards = [
          {id: 1, type: 'dash-folder'},
          {id: 2, type: 'dash-db', checked: true}
        ];
        ctrl.selectionChanged();
      });

      it('should enable Move To button', () => {
        expect(ctrl.canMove).toBeTruthy();
      });

      it('should enable delete button', () => {
        expect(ctrl.canDelete).toBeTruthy();
      });
    });

    describe('and one child dashboard is selected', () => {
      beforeEach(() => {
        ctrl.dashboards = [
          {id: 1, type: 'dash-folder'},
          {id: 2, type: 'dash-child', checked: true}
        ];
        ctrl.selectionChanged();
      });

      it('should enable Move To button', () => {
        expect(ctrl.canMove).toBeTruthy();
      });

      it('should enable delete button', () => {
        expect(ctrl.canDelete).toBeTruthy();
      });
    });

    describe('and one child dashboard and one dashboard is selected', () => {
      beforeEach(() => {
        ctrl.dashboards = [
          {id: 1, type: 'dash-folder'},
          {id: 2, type: 'dash-child', checked: true}
        ];
        ctrl.selectionChanged();
      });

      it('should enable Move To button', () => {
        expect(ctrl.canMove).toBeTruthy();
      });

      it('should enable delete button', () => {
        expect(ctrl.canDelete).toBeTruthy();
      });
    });

    describe('and one child dashboard and one folder is selected', () => {
      beforeEach(() => {
        ctrl.dashboards = [
          {id: 1, type: 'dash-folder', checked: true},
          {id: 2, type: 'dash-child', checked: true}
        ];
        ctrl.selectionChanged();
      });

      it('should disable Move To button', () => {
        expect(ctrl.canMove).toBeFalsy();
      });

      it('should enable delete button', () => {
        expect(ctrl.canDelete).toBeTruthy();
      });
    });
  });
});
