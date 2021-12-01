import { e2e } from '@grafana/e2e';

const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

describe('Repeating a panel vertically', () => {
  it('should be able to repeat a panel vertically', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    e2e.components.Panels.Panel.title('Panel Title 1').should('be.visible');
    e2e.components.Panels.Panel.title('Panel Title 2').should('be.visible');
    e2e.components.Panels.Panel.title('Panel Title 3').should('be.visible');
  });
});
