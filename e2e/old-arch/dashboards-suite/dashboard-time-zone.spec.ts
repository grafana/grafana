import {
  addDays,
  addHours,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isBefore,
  parseISO,
  toDate,
} from 'date-fns';

import { e2e } from '../utils';

describe('Dashboard time zone support', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it.skip('Tests dashboard time zone scenarios', () => {
    e2e.flows.openDashboard({ uid: '5SdHCasdf' });

    const fromTimeZone = 'UTC';
    const toTimeZone = 'America/Chicago';
    const offset = offsetBetweenTimeZones(toTimeZone, fromTimeZone);

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
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .within(() => {
          e2e.components.Panels.Visualization.Graph.xAxis.labels().should('be.visible');
          e2e.components.Panels.Visualization.Graph.xAxis
            .labels()
            .last()
            .should((element) => {
              timesInUtc[title] = element.text();
            });
        });
    }

    e2e.components.PageToolbar.item('Dashboard settings').click();

    e2e.components.TimeZonePicker.containerV2()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.singleValue().should('have.text', 'Coordinated Universal Time');
        e2e.components.Select.input().should('be.visible').click();
      });

    e2e.components.Select.option().should('be.visible').contains(toTimeZone).click();

    // click to go back to the dashboard.
    e2e.pages.Dashboard.Settings.Actions.close().click();
    e2e.components.RefreshPicker.runButtonV2().should('be.visible').click();

    for (const title of panelsToCheck) {
      e2e.components.Panels.Panel.title(title)
        .should('be.visible')
        .within(() => {
          e2e.components.Panels.Visualization.Graph.xAxis.labels().should('be.visible');
          e2e.components.Panels.Visualization.Graph.xAxis
            .labels()
            .last()
            .should((element) => {
              const inUtc = timesInUtc[title];
              const inTz = element.text();
              const isCorrect = isTimeCorrect(inUtc, inTz, offset);
              expect(isCorrect).to.be.equal(true);
            });
        });
    }
  });

  it('Tests relative timezone support and overrides', () => {
    // Open dashboard
    e2e.flows.openDashboard({
      uid: 'd41dbaa2-a39e-4536-ab2b-caca52f1a9c8',
    });

    cy.intercept('/api/ds/query*').as('dataQuery');

    // Switch to Browser timezone
    e2e.flows.setTimeRange({
      from: 'now-6h',
      to: 'now',
      zone: 'Browser',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    // Today so far, still in Browser timezone
    e2e.flows.setTimeRange({
      from: 'now/d',
      to: 'now',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    e2e.components.Panels.Panel.title('Panel in timezone')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    // Test UTC timezone
    e2e.flows.setTimeRange({
      from: 'now-6h',
      to: 'now',
      zone: 'Coordinated Universal Time',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    // Today so far, still in UTC timezone
    e2e.flows.setTimeRange({
      from: 'now/d',
      to: 'now',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    e2e.components.Panels.Panel.title('Panel in timezone')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    // Test Tokyo timezone
    e2e.flows.setTimeRange({
      from: 'now-6h',
      to: 'now',
      zone: 'Asia/Tokyo',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    // Today so far, still in Tokyo timezone
    e2e.flows.setTimeRange({
      from: 'now/d',
      to: 'now',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    e2e.components.Panels.Panel.title('Panel in timezone')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    // Test LA timezone
    e2e.flows.setTimeRange({
      from: 'now-6h',
      to: 'now',
      zone: 'America/Los Angeles',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    // Today so far, still in LA timezone
    e2e.flows.setTimeRange({
      from: 'now/d',
      to: 'now',
    });
    // Need to wait for 2 calls as there's 2 panels
    cy.wait(['@dataQuery', '@dataQuery']);

    e2e.components.Panels.Panel.title('Panel with relative time override')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });

    e2e.components.Panels.Panel.title('Panel in timezone')
      .should('be.visible')
      .within(() => {
        cy.contains('[role="row"]', '00:00:00').should('be.visible');
      });
  });
});

const isTimeCorrect = (inUtc: string, inTz: string, offset: number): boolean => {
  if (inUtc === inTz) {
    // we need to catch issues when timezone isn't changed for some reason like https://github.com/grafana/grafana/issues/35504
    return false;
  }

  const reference = format(new Date(), 'yyyy-LL-dd');

  const utcDate = toDate(parseISO(`${reference} ${inUtc}`));
  const utcDateWithOffset = addHours(toDate(parseISO(`${reference} ${inUtc}`)), offset);
  const dayDifference = differenceInCalendarDays(utcDate, utcDateWithOffset); // if the utcDate +/- offset is the day before/after then we need to adjust reference
  const dayOffset = isBefore(utcDateWithOffset, utcDate) ? dayDifference * -1 : dayDifference;
  const tzDate = addDays(toDate(parseISO(`${reference} ${inTz}`)), dayOffset); // adjust tzDate with any dayOffset
  const diff = Math.abs(differenceInMinutes(utcDate, tzDate)); // use Math.abs if tzDate is in future

  return diff <= Math.abs(offset * 60);
};

const offsetBetweenTimeZones = (timeZone1: string, timeZone2: string, when: Date = new Date()): number => {
  const t1 = convertDateToAnotherTimeZone(when, timeZone1);
  const t2 = convertDateToAnotherTimeZone(when, timeZone2);
  return (t1.getTime() - t2.getTime()) / (1000 * 60 * 60);
};

const convertDateToAnotherTimeZone = (date: Date, timeZone: string): Date => {
  const dateString = date.toLocaleString('en-US', {
    timeZone: timeZone,
  });
  return new Date(dateString);
};
