import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'WVpf2jp7z/repeating-a-panel-horizontally';

describe('Repeating a panel horizontally', () => {
  beforeEach(() => {
    e2e.flows.login('admin', 'admin');
  });

  it('should be able to repeat a panel horizontally', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    let prevLeft = Number.NEGATIVE_INFINITY;
    let prevTop = null;
    const panelTitles = ['Panel Title 1', 'Panel Title 2', 'Panel Title 3'];
    panelTitles.forEach((title) => {
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .then(($el) => {
          const { left, top } = $el[0].getBoundingClientRect();
          expect(left).to.be.greaterThan(prevLeft);
          if (prevTop !== null) {
            expect(top).to.be.equal(prevTop);
          }

          prevLeft = left;
          prevTop = top;
        });
    });
  });

  it('responds to changes to the variables', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    let prevLeft = Number.NEGATIVE_INFINITY;
    let prevTop = null;
    const panelTitles = ['Panel Title 1', 'Panel Title 2', 'Panel Title 3'];
    panelTitles.forEach((title) => {
      e2e.components.Panels.Panel.title(title).should('be.visible');
    });

    // Change to only show panels 1 + 3
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('horizontal').click();
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
          expect(left).to.be.greaterThan(prevLeft);
          if (prevTop !== null) {
            expect(top).to.be.equal(prevTop);
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
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?var-horizontal=1&var-horizontal=3` });
    let prevLeft = Number.NEGATIVE_INFINITY;
    let prevTop = null;
    const panelsShown = ['Panel Title 1', 'Panel Title 3'];
    const panelsNotShown = ['Panel Title 2'];
    // Check correct panels are displayed
    panelsShown.forEach((title) => {
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .then(($el) => {
          const { left, top } = $el[0].getBoundingClientRect();
          expect(left).to.be.greaterThan(prevLeft);
          if (prevTop !== null) {
            expect(top).to.be.equal(prevTop);
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
