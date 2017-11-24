import { DashboardListCtrl } from '../dashboard_list_ctrl';
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
          checked: false,
          expanded: true,
          hideHeader: true,
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
            },
            {
              id: 500,
              title: "Dashboard Test",
              url: "dashboard/db/dashboard-test",
              icon: 'fa fa-folder',
              tags: [],
              folderId: 499,
              isStarred: false
            }
          ]
        }
      ];

      ctrl = createCtrlWithStubs(response);
    });

    describe('with query filter', () => {
      beforeEach(() => {
        ctrl.query.query = 'd';
        ctrl.canMove = true;
        ctrl.canDelete = true;
        ctrl.selectAllChecked = true;
        return ctrl.getDashboards();
      });

      it('should set checked to false on all sections and children', () => {
        expect(ctrl.sections.length).toEqual(1);
        expect(ctrl.sections[0].checked).toEqual(false);
        expect(ctrl.sections[0].items[0].checked).toEqual(false);
        expect(ctrl.sections[0].items[1].checked).toEqual(false);
      });

      it('should uncheck select all', () => {
        expect(ctrl.selectAllChecked).toBeFalsy();
      });

      it('should disable Move To button', () => {
        expect(ctrl.canMove).toBeFalsy();
      });

      it('should disable delete button', () => {
        expect(ctrl.canDelete).toBeFalsy();
      });

      describe('when select all is checked', () => {
        beforeEach(() => {
          ctrl.selectAllChecked = true;
          ctrl.onSelectAllChanged();
        });

        it('should select all dashboards', () => {
          expect(ctrl.sections[0].checked).toBeFalsy();
          expect(ctrl.sections[0].items[0].checked).toBeTruthy();
          expect(ctrl.sections[0].items[1].checked).toBeTruthy();
        });

        it('should enable Move To button', () => {
          expect(ctrl.canMove).toBeTruthy();
        });

        it('should enable delete button', () => {
          expect(ctrl.canDelete).toBeTruthy();
        });
      });
    });

    describe('with tag filter', () => {
      beforeEach(() => {
        return ctrl.filterByTag('test');
      });

      it('should set tag filter', () => {
        expect(ctrl.sections.length).toEqual(1);
        expect(ctrl.query.tag[0]).toEqual('test');
      });
    });

    describe('with starred filter', () => {
      beforeEach(() => {
        const yesOption: any = ctrl.starredFilterOptions[1];

        ctrl.selectedStarredFilter = yesOption;
        return ctrl.onStarredFilterChange();
      });

      it('should set starred filter', () => {
        expect(ctrl.sections.length).toEqual(1);
        expect(ctrl.query.starred).toEqual(true);
      });
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

      describe('when select all is checked', () => {
        beforeEach(() => {
          ctrl.selectAllChecked = true;
          ctrl.onSelectAllChanged();
        });

        it('should select all folders and dashboards', () => {
          expect(ctrl.sections[0].checked).toBeTruthy();
          expect(ctrl.sections[0].items[0].checked).toBeTruthy();
          expect(ctrl.sections[1].checked).toBeTruthy();
          expect(ctrl.sections[1].items[0].checked).toBeTruthy();
        });

        it('should disable Move To button', () => {
          expect(ctrl.canMove).toBeFalsy();
        });

        it('should enable delete button', () => {
          expect(ctrl.canDelete).toBeTruthy();
        });
      });
    });

    describe('and all folders and dashboards are selected', () => {
      beforeEach(() => {
        ctrl.sections = [
          {
            id: 1,
            items: [
              { id: 2, checked: true }
            ],
            checked: true
          },
          {
            id: 0,
            items: [
              { id: 3, checked: true }
            ],
            checked: true
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

      describe('when select all is unchecked', () => {
        beforeEach(() => {
          ctrl.selectAllChecked = false;
          ctrl.onSelectAllChanged();
        });

        it('should uncheck all checked folders and dashboards', () => {
          expect(ctrl.sections[0].checked).toBeFalsy();
          expect(ctrl.sections[0].items[0].checked).toBeFalsy();
          expect(ctrl.sections[1].checked).toBeFalsy();
          expect(ctrl.sections[1].items[0].checked).toBeFalsy();
        });

        it('should disable Move To button', () => {
          expect(ctrl.canMove).toBeFalsy();
        });

        it('should disable delete button', () => {
          expect(ctrl.canDelete).toBeFalsy();
        });
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

function createCtrlWithStubs(searchResponse: any, tags?: any) {
  const searchSrvStub = {
    search: (options: any) => {
      return q.resolve(searchResponse);
    },
    toggleSection: (section) => {
      return;
    },
    getDashboardTags: () => {
      return q.resolve(tags || []);
    }
  };

  return new DashboardListCtrl({}, { getNav: () => { } }, q, <SearchSrv>searchSrvStub);
}
