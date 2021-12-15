import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

describe('Repeating a panel vertically', () => {
  it('should be able to repeat a panel vertically', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    let prevTop = Number.NEGATIVE_INFINITY;
    const panelTitles = [
      'Panel Title 1',
      'Panel Title 2',
      'Panel Title 3',
    ]
    panelTitles.forEach((title) => {
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .then(($el) => {
          const top = $el[0].getBoundingClientRect().top;
          expect(top).to.be.greaterThan(prevTop);
          prevTop = top;
        });
    })
  });
});
