import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'WVpf2jp7z/repeating-a-panel-horizontally';

describe('Repeating a panel horizontally', () => {
  it('should be able to repeat a panel horizontally', () => {
    e2e.flows.login('admin', 'admin');
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

  // TODO: Add test for the case when we pass variables in the url
});
