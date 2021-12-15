import { e2e } from '@grafana/e2e';

const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

describe('Repeating a panel vertically', () => {
  it('should be able to repeat a panel vertically', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    // const panelTitles = [
    //   e2e.components.Panels.Panel.title('Panel Title 1'),
    //   e2e.components.Panels.Panel.title('Panel Title 2'),
    //   e2e.components.Panels.Panel.title('Panel Title 3'),
    // ];

    e2e()
      .get(`[data-testid^="data-testid Panel header"]`)
      .should('have.length', 3)
      .each((element) => cy.log(element))
      .then((element) => {
        cy.log(`have ${element.length} panels??`);
        cy.log(element[0].getBoundingClientRect().top);
      });

    //panelTitles.forEach((panelTitle, i) => {
    //  panelTitle.should('be.visible');
    //  panelTitle.then((element) => {
    //    cy.log(element[0].getBoundingClientRect().top);
    //  });
    // expect(
    //   panelTitles[i].getBoundingClientRect().y > panelTitles?.[i - 1].getBoundingClientRect().y ??
    //     Number.NEGATIVE_INFINITY
    // );
    //});
  });
});
