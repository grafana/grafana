import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'dtpl2Ctnk/repeating-an-empty-row';

describe('Repeating empty rows', () => {
  beforeEach(() => {
    e2e.flows.login('admin', 'admin');
  });

  it('should be able to repeat empty rows vertically', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    let prevTop = Number.NEGATIVE_INFINITY;
    const rowTitles = ['Row title 1', 'Row title 2', 'Row title 3'];
    rowTitles.forEach((title) => {
      e2e.components.DashboardRow.title(title)
        .should('be.visible')
        .then(($el) => {
          const { top } = $el[0].getBoundingClientRect();
          expect(top).to.be.greaterThan(prevTop);
          prevTop = top;
        });
    });
  });

  it('responds to changes to the variables', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    let prevTop = Number.NEGATIVE_INFINITY;
    const rowTitles = ['Row title 1', 'Row title 2', 'Row title 3'];

    rowTitles.forEach((title) => {
      e2e.components.DashboardRow.title(title).should('be.visible');
    });

    // Change to only show rows 1 + 3
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('row').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('1').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('3').click();
    // blur the dropdown
    e2e().get('body').click();

    const rowsShown = ['Row title 1', 'Row title 3'];
    const rowsNotShown = ['Row title 2'];
    rowsShown.forEach((title) => {
      e2e.components.DashboardRow.title(title)
        .should('be.visible')
        .then(($el) => {
          const { top } = $el[0].getBoundingClientRect();
          expect(top).to.be.greaterThan(prevTop);
          prevTop = top;
        });
    });

    rowsNotShown.forEach((title) => {
      e2e.components.DashboardRow.title(title).should('not.exist');
    });
  });

  it('loads a dashboard based on the query params correctly', () => {
    // Have to manually add the queryParams to the url because they have the same name
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?var-row=1&var-row=3` });

    let prevTop = Number.NEGATIVE_INFINITY;
    const rowsShown = ['Row title 1', 'Row title 3'];
    const rowsNotShown = ['Row title 2'];
    rowsShown.forEach((title) => {
      e2e.components.DashboardRow.title(title)
        .should('be.visible')
        .then(($el) => {
          const { top } = $el[0].getBoundingClientRect();
          expect(top).to.be.greaterThan(prevTop);
          prevTop = top;
        });
    });

    rowsNotShown.forEach((title) => {
      e2e.components.DashboardRow.title(title).should('not.exist');
    });
  });
});
