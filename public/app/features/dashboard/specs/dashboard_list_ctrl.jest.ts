import {DashboardListCtrl} from '../dashboard_list_ctrl';
import { SearchSrv } from 'app/core/services/search_srv';
import q from 'q';

describe('DashboardListCtrl', () => {
  let ctrl;

  describe('when browsing dashboards', () => {
    beforeEach(() => {
      const response = [
        {
          id: 410,
          title: "afolder",
          type: "dash-folder",
          items: [
            {
              id: 399,
              title: "Dashboard Test",
              url: "dashboard/db/dashboard-test",
              icon: 'fa fa-folder',
              tags: [],
              isStarred: false,
              folderId: 410,
              folderTitle: "afolder",
              folderSlug: "afolder"
            }
          ],
          tags: [],
          isStarred: false
        },
        {
          id: 0,
          title: "Root",
          icon: 'fa fa-folder-open',
          uri: "db/something-else",
          type: "dash-db",
          items: [
            {
              id: 500,
              title: "Dashboard Test",
              url: "dashboard/db/dashboard-test",
              icon: 'fa fa-folder',
              tags: [],
              isStarred: false
            }
          ],
          tags: [],
          isStarred: false,
        }
      ];
      ctrl = createCtrlWithStubs(response);
      return ctrl.getDashboards();
    });

    it('should set checked to false on all sections and children', () => {
      expect(ctrl.sections.length).toEqual(2);
      expect(ctrl.sections[0].checked).toEqual(false);
      expect(ctrl.sections[0].items[0].checked).toEqual(false);
      expect(ctrl.sections[1].checked).toEqual(false);
      expect(ctrl.sections[1].items[0].checked).toEqual(false);
    });
  });

  describe('when searching dashboards', () => {
    beforeEach(() => {
      const response = [
        {
          id: 410,
          title: "afolder",
          type: "dash-folder",
          items: [
            {
              id: 399,
              title: "Dashboard Test",
              url: "dashboard/db/dashboard-test",
              icon: 'fa fa-folder',
              tags: [],
              isStarred: false,
              folderId: 410,
              folderTitle: "afolder",
              folderSlug: "afolder"
            }
          ],
          tags: [],
          isStarred: false
        },
        {
          id: 0,
          title: "Root",
          icon: 'fa fa-folder-open',
          uri: "db/something-else",
          type: "dash-db",
          items: [
            {
              id: 500,
              title: "Dashboard Test",
              url: "dashboard/db/dashboard-test",
              icon: 'fa fa-folder',
              tags: [],
              isStarred: false
            }
          ],
          tags: [],
          isStarred: false,
        }
      ];
      ctrl = createCtrlWithStubs(response);
      ctrl.query.query = 'd';
      return ctrl.getDashboards();
    });

    it('should set checked to false on all sections and children', () => {
      expect(ctrl.sections.length).toEqual(2);
      expect(ctrl.sections[0].checked).toEqual(false);
      expect(ctrl.sections[0].items[0].checked).toEqual(false);
      expect(ctrl.sections[1].checked).toEqual(false);
      expect(ctrl.sections[1].items[0].checked).toEqual(false);
    });
  });

  describe('when selecting dashboards', () => {
    let ctrl;

    beforeEach(() => {
      ctrl = createCtrlWithStubs([]);
    });

    describe('and no dashboards are selected', () => {
      beforeEach(() => {
        ctrl.sections = [
          {
            id: 1,
            items: [
              { id: 2, checked: false }
            ],
            checked: false
          },
          {
            id: 0,
            items: [
              { id: 3, checked: false }
            ],
            checked: false
          }
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
        ctrl.sections = [
          {
            id: 1,
            title: 'folder',
            items: [
              { id: 2, checked: false }
            ],
            checked: false
          },
          {
            id: 0,
            title: 'Root',
            items: [
              { id: 3, checked: true }
            ],
            checked: false
          }
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
        ctrl.sections = [
          {
            id: 1,
            title: 'folder',
            items: [
              { id: 2, checked: true }
            ],
            checked: false
          },
          {
            id: 0,
            title: 'Root',
            items: [
              { id: 3, checked: false }
            ],
            checked: false
          }
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
        ctrl.sections = [
          {
            id: 1,
            title: 'folder',
            items: [
              { id: 2, checked: true }
            ],
            checked: false
          },
          {
            id: 0,
            title: 'Root',
            items: [
              { id: 3, checked: true }
            ],
            checked: false
          }
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
        ctrl.sections = [
          {
            id: 1,
            title: 'folder',
            items: [
              { id: 2, checked: false }
            ],
            checked: true
          },
          {
            id: 3,
            title: 'folder',
            items: [
              { id: 4, checked: true }
            ],
            checked: false
          },
          {
            id: 0,
            title: 'Root',
            items: [
              { id: 3, checked: false }
            ],
            checked: false
          }
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

  describe('when deleting dashboards', () => {
    beforeEach(() => {
      ctrl = createCtrlWithStubs([]);

      ctrl.sections = [
        {
          id: 1,
          title: 'folder',
          items: [
            { id: 2, checked: true, uri: 'dash' }
          ],
          checked: true,
          uri: 'folder'
        },
        {
          id: 0,
          title: 'Root',
          items: [
            { id: 3, checked: true, uri: 'dash-2' }
          ],
          checked: false
        }
      ];
    });

    it('should filter out children if parent is selected', () => {
      const toBeDeleted = ctrl.getDashboardsToDelete();
      expect(toBeDeleted.length).toEqual(2);
      expect(toBeDeleted[0]).toEqual('folder');
      expect(toBeDeleted[1]).toEqual('dash-2');
    });
  });

  describe('when moving dashboards', () => {
    beforeEach(() => {
      ctrl = createCtrlWithStubs([]);

      ctrl.sections = [
        {
          id: 1,
          title: 'folder',
          items: [
            { id: 2, checked: true, uri: 'dash' }
          ],
          checked: false,
          uri: 'folder'
        },
        {
          id: 0,
          title: 'Root',
          items: [
            { id: 3, checked: true, uri: 'dash-2' }
          ],
          checked: false
        }
      ];
    });

    it('should get selected dashboards', () => {
      const toBeMove = ctrl.getDashboardsToMove();
      expect(toBeMove.length).toEqual(2);
      expect(toBeMove[0]).toEqual('dash');
      expect(toBeMove[1]).toEqual('dash-2');
    });
  });
});

function createCtrlWithStubs(response: any) {
  const searchSrvStub = {
    browse: () => {
      return  q.resolve(response);
    },
    search: (options: any) => {
      return  q.resolve(response);
    },
    toggleFolder: (section) => {
      return  q.resolve(response);
    },
    getDashboardTags: () => {
      return  q.resolve([]);
    }
  };

  return new DashboardListCtrl({}, {getNav: () => {}}, q, <SearchSrv>searchSrvStub);
}
