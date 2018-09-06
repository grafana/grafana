import { SearchCtrl } from '../components/search/search';
import { SearchSrv } from '../services/search_srv';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

describe('SearchCtrl', () => {
  const searchSrvStub = {
    search: (options: any) => {},
    getDashboardTags: () => {},
  };
  const ctrl = new SearchCtrl({ $on: () => {} }, {}, {}, searchSrvStub as SearchSrv);

  describe('Given an empty result', () => {
    beforeEach(() => {
      ctrl.results = [];
    });

    describe('When navigating down one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(1);
      });

      it('should not navigate', () => {
        expect(ctrl.selectedIndex).toBe(0);
      });
    });

    describe('When navigating up one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(-1);
      });

      it('should not navigate', () => {
        expect(ctrl.selectedIndex).toBe(0);
      });
    });
  });

  describe('Given a result of one selected collapsed folder with no dashboards and a root folder with 2 dashboards', () => {
    beforeEach(() => {
      ctrl.results = [
        {
          id: 1,
          title: 'folder',
          items: [],
          selected: true,
          expanded: false,
          toggle: i => (i.expanded = !i.expanded),
        },
        {
          id: 0,
          title: 'General',
          items: [{ id: 3, selected: false }, { id: 5, selected: false }],
          selected: false,
          expanded: true,
          toggle: i => (i.expanded = !i.expanded),
        },
      ];
    });

    describe('When navigating down one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(1);
      });

      it('should select first dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeTruthy();
        expect(ctrl.results[1].items[1].selected).toBeFalsy();
      });
    });

    describe('When navigating down two steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
      });

      it('should select last dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeFalsy();
        expect(ctrl.results[1].items[1].selected).toBeTruthy();
      });
    });

    describe('When navigating down three steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
      });

      it('should select first folder', () => {
        expect(ctrl.results[0].selected).toBeTruthy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeFalsy();
        expect(ctrl.results[1].items[1].selected).toBeFalsy();
      });
    });

    describe('When navigating up one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(-1);
      });

      it('should select last dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeFalsy();
        expect(ctrl.results[1].items[1].selected).toBeTruthy();
      });
    });

    describe('When navigating up two steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(-1);
        ctrl.moveSelection(-1);
      });

      it('should select first dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeTruthy();
        expect(ctrl.results[1].items[1].selected).toBeFalsy();
      });
    });
  });

  describe('Given a result of one selected collapsed folder with 2 dashboards and a root folder with 2 dashboards', () => {
    beforeEach(() => {
      ctrl.results = [
        {
          id: 1,
          title: 'folder',
          items: [{ id: 2, selected: false }, { id: 4, selected: false }],
          selected: true,
          expanded: false,
          toggle: i => (i.expanded = !i.expanded),
        },
        {
          id: 0,
          title: 'General',
          items: [{ id: 3, selected: false }, { id: 5, selected: false }],
          selected: false,
          expanded: true,
          toggle: i => (i.expanded = !i.expanded),
        },
      ];
    });

    describe('When navigating down one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(1);
      });

      it('should select first dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeTruthy();
        expect(ctrl.results[1].items[1].selected).toBeFalsy();
      });
    });

    describe('When navigating down two steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
      });

      it('should select last dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeFalsy();
        expect(ctrl.results[1].items[1].selected).toBeTruthy();
      });
    });

    describe('When navigating down three steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
      });

      it('should select first folder', () => {
        expect(ctrl.results[0].selected).toBeTruthy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeFalsy();
        expect(ctrl.results[1].items[1].selected).toBeFalsy();
      });
    });

    describe('When navigating up one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(-1);
      });

      it('should select last dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeFalsy();
        expect(ctrl.results[1].items[1].selected).toBeTruthy();
      });
    });

    describe('When navigating up two steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 0;
        ctrl.moveSelection(-1);
        ctrl.moveSelection(-1);
      });

      it('should select first dashboard in root folder', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[1].selected).toBeFalsy();
        expect(ctrl.results[1].items[0].selected).toBeTruthy();
        expect(ctrl.results[1].items[1].selected).toBeFalsy();
      });
    });
  });

  describe('Given a result of a search with 2 dashboards where the first is selected', () => {
    beforeEach(() => {
      ctrl.results = [
        {
          hideHeader: true,
          items: [{ id: 3, selected: true }, { id: 5, selected: false }],
          selected: false,
          expanded: true,
          toggle: i => (i.expanded = !i.expanded),
        },
      ];
    });

    describe('When navigating down one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 1;
        ctrl.moveSelection(1);
      });

      it('should select last dashboard', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[1].selected).toBeTruthy();
      });
    });

    describe('When navigating down two steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 1;
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
      });

      it('should select first dashboard', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeTruthy();
        expect(ctrl.results[0].items[1].selected).toBeFalsy();
      });
    });

    describe('When navigating down three steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 1;
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
        ctrl.moveSelection(1);
      });

      it('should select last dashboard', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[1].selected).toBeTruthy();
      });
    });

    describe('When navigating up one step', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 1;
        ctrl.moveSelection(-1);
      });

      it('should select last dashboard', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[1].selected).toBeTruthy();
      });
    });

    describe('When navigating up two steps', () => {
      beforeEach(() => {
        ctrl.selectedIndex = 1;
        ctrl.moveSelection(-1);
        ctrl.moveSelection(-1);
      });

      it('should select first dashboard', () => {
        expect(ctrl.results[0].selected).toBeFalsy();
        expect(ctrl.results[0].items[0].selected).toBeTruthy();
        expect(ctrl.results[0].items[1].selected).toBeFalsy();
      });
    });
  });
});
