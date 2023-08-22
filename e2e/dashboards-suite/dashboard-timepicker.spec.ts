import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Dashboard timepicker',
  itName: 'Shows the correct calendar days with custom timezone set via preferences',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.setUserPreferences({
      timezone: 'Asia/Tokyo',
    });

    // Open dashboard with time range from 8th to end of 10th.
    // Will be Tokyo time because of above preference
    e2e.flows.openDashboard({
      uid: '5SdHCasdf',
      timeRange: {
        zone: 'Default',
        from: '2022-06-08 00:00:00',
        to: '2022-06-10 23:59:59',
      },
    });

    // Assert that the calendar shows 08 and 09 and 10 as selected days
    e2e.components.TimePicker.openButton().click();
    e2e.components.TimePicker.calendar.openButton().first().click();
    e2e().get('.react-calendar__tile--active, .react-calendar__tile--hasActive').should('have.length', 3);
  },
});

e2e.scenario({
  describeName: 'Dashboard timepicker',
  itName: 'Shows the correct calendar days with custom timezone set via time picker',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // Open dashboard with time range from 2022-06-08 00:00:00 to 2022-06-10 23:59:59 in Tokyo time
    e2e.flows.openDashboard({
      uid: '5SdHCasdf',
      timeRange: {
        zone: 'Asia/Tokyo',
        from: '2022-06-08 00:00:00',
        to: '2022-06-10 23:59:59',
      },
    });

    // Assert that the calendar shows 08 and 09 and 10 as selected days
    e2e.components.TimePicker.openButton().click();
    e2e.components.TimePicker.calendar.openButton().first().click();
    e2e().get('.react-calendar__tile--active, .react-calendar__tile--hasActive').should('have.length', 3);
  },
});
