import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

describe('Repeating a panel vertically', () => {
  it('should be able to repeat a panel vertically', () => {
    e2e.flows.login('admin', 'admin');
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

  // TODO: Add test for the case when we pass variables in the url
});
