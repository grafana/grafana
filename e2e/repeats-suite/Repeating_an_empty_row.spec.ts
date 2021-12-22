import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'dtpl2Ctnk/repeating-an-empty-row';

describe('Repeating empty rows', () => {
  it('should be able to repeat empty rows vertically', () => {
    e2e.flows.login('admin', 'admin');
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

  // TODO: Add test for the case when we pass variables in the url
});
