import { e2e } from '@grafana/e2e';

const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

describe('Repeating a panel vertically', () => {
  it('should be able to repeat a panel vertically', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    const panelTitles = [
      e2e.components.Panels.Panel.title('Panel Title 1'),
      e2e.components.Panels.Panel.title('Panel Title 2'),
      e2e.components.Panels.Panel.title('Panel Title 3'),
    ];

    panelTitles.forEach((panelTitle, i) => {
      panelTitle.should('be.visible');
      expect(
        panelTitles[i].getBoundingClientRect().y > panelTitles?.[i - 1].getBoundingClientRect().y ??
          Number.NEGATIVE_INFINITY
      );
    });
  });
});
