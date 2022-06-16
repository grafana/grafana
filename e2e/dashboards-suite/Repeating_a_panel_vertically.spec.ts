import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

describe('Repeating a panel vertically', () => {
  beforeEach(() => {
    e2e.flows.login('admin', 'admin');
  });

  it('should be able to repeat a panel vertically', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    let prevTop = Number.NEGATIVE_INFINITY;
    let prevLeft = null;
    const panelTitles = ['Panel Title 1', 'Panel Title 2', 'Panel Title 3'];
    panelTitles.forEach((title) => {
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .then(($el) => {
          const { left, top } = $el[0].getBoundingClientRect();
          expect(top).to.be.greaterThan(prevTop);
          if (prevLeft !== null) {
            expect(left).to.be.equal(prevLeft);
          }
          prevLeft = left;
          prevTop = top;
        });
    });
  });

  it('responds to changes to the variables', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    let prevTop = Number.NEGATIVE_INFINITY;
    let prevLeft = null;
    const panelTitles = ['Panel Title 1', 'Panel Title 2', 'Panel Title 3'];
    panelTitles.forEach((title) => {
      e2e.components.Panels.Panel.title(title).should('be.visible');
    });

    // Change to only show panels 1 + 3
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('vertical').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('1').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('3').click();
    // blur the dropdown
    e2e().get('body').click();

    const panelsShown = ['Panel Title 1', 'Panel Title 3'];
    const panelsNotShown = ['Panel Title 2'];
    panelsShown.forEach((title) => {
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .then(($el) => {
          const { left, top } = $el[0].getBoundingClientRect();
          expect(top).to.be.greaterThan(prevTop);
          if (prevLeft !== null) {
            expect(left).to.be.equal(prevLeft);
          }
          prevLeft = left;
          prevTop = top;
        });
    });
    panelsNotShown.forEach((title) => {
      e2e.components.Panels.Panel.title(title).should('not.exist');
    });
  });

  it('loads a dashboard based on the query params correctly', () => {
    // Have to manually add the queryParams to the url because they have the same name
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?var-vertical=1&var-vertical=3` });

    let prevTop = Number.NEGATIVE_INFINITY;
    let prevLeft = null;
    const panelsShown = ['Panel Title 1', 'Panel Title 3'];
    const panelsNotShown = ['Panel Title 2'];
    panelsShown.forEach((title) => {
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .then(($el) => {
          const { left, top } = $el[0].getBoundingClientRect();
          expect(top).to.be.greaterThan(prevTop);
          if (prevLeft !== null) {
            expect(left).to.be.equal(prevLeft);
          }
          prevLeft = left;
          prevTop = top;
        });
    });
    panelsNotShown.forEach((title) => {
      e2e.components.Panels.Panel.title(title).should('not.exist');
    });
  });
});
