import { e2e } from '@grafana/e2e';
import { addHours, differenceInMinutes, format, parse } from 'date-fns';

e2e.scenario({
  describeName: 'Dashboard time zone support',
  itName: 'Tests dashboard time zone scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: '5SdHCasdf' });

    const fromTimeZone = 'Coordinated Universal Time';
    const toTimeZone = 'America/Chicago';
    const offset = -5;

    const panelsToCheck = [
      'Random walk series',
      'Millisecond res x-axis and tooltip',
      '2 yaxis and axis labels',
      'Stacking value ontop of nulls',
      'Null between points',
      'Legend Table No Scroll Visible',
    ];

    const timesInUtc: Record<string, string> = {};

    for (const title of panelsToCheck) {
      e2e.components.Panels.Panel.containerByTitle(title)
        .should('be.visible')
        .within(() =>
          e2e.components.Panels.Visualization.Graph.xAxis
            .labels()
            .should('be.visible')
            .last()
            .should((element) => {
              timesInUtc[title] = element.text();
            })
        );
    }

    e2e.components.PageToolbar.item('Dashboard settings').click();

    e2e.components.TimeZonePicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.singleValue().should('be.visible').should('have.text', fromTimeZone);

        e2e.components.Select.input().should('be.visible').click();

        e2e.components.Select.option().should('be.visible').contains(toTimeZone).click();
      });

    // click outside the time zone selector to deselect it.
    e2e.components.BackButton.backArrow().click();
    // click to go back to the dashboard.
    e2e.components.BackButton.backArrow().click();

    for (const title of panelsToCheck) {
      e2e.components.Panels.Panel.containerByTitle(title)
        .should('be.visible')
        .within(() =>
          e2e.components.Panels.Visualization.Graph.xAxis
            .labels()
            .should('be.visible')
            .last()
            .should((element) => {
              const inUtc = timesInUtc[title];
              const inTz = element.text();
              const isCorrect = isTimeCorrect(inUtc, inTz, offset);
              assert.isTrue(isCorrect, `Panel with title: "${title}"`);
            })
        );
    }
  },
});

const isTimeCorrect = (inUtc: string, inTz: string, offset: number): boolean => {
  const reference = format(new Date(), 'YYYY-MM-DD');

  const a = parse(`${reference} ${inUtc}`);
  const b = addHours(parse(`${reference} ${inTz}`), offset);

  return differenceInMinutes(a, b) <= 1;
};
