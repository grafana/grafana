import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

describe('Repeating a panel vertically', () => {
  it('should be able to repeat a panel vertically', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    let prevTop = Number.NEGATIVE_INFINITY;
    e2e()
      .get(`[data-testid^="data-testid Panel header"]`)
      .should('have.length', 3)
      .each((el, i) => {
        expect(el).to.have.text(`Panel Title ${i + 1}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect(el).to.be.visible;

        const top = el[0].getBoundingClientRect().top;
        expect(top).to.be.greaterThan(prevTop);
        prevTop = top;
      });
  });
});
