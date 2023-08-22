import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Dashboard timepicker',
  itName: 'Shows the correct calendar days with custom timezone set via preferences',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    //Make sure that the browser time zone is set to UTC - it's set to Pacific/Honolulu UTC-12
    //Open preferences page and set timezone to Tokyo
    e2e.pages.ProfilePage.visit();

    e2e.flows.selectOption({
      container: e2e.components.TimeZonePicker.containerV2(),
      optionText: 'Asia/Tokyo',
    });

    // This refreshes the page
    e2e.components.UserProfile.preferencesSaveButton().click();

    //Open dashboard with time range from 2022-06-08 00:00:00 to 2022-06-10 23:59:59
    // e2e().visit('/dashboard/new');
    e2e.flows.openDashboard({
      uid: '5SdHCasdf',
      timeRange: {
        zone: 'Default',
        from: '2022-06-08 00:00:00',
        to: '2022-06-10 23:59:59',
      },
    });

    //Open timepicker
    e2e.components.TimePicker.openButton().click();
    //Open calendar
    e2e.components.TimePicker.calendar.openButton().first().click();
    //Assert that the calendar shows 08 and 09 and 10 as selected days
    e2e().get('.react-calendar__tile--active, .react-calendar__tile--hasActive').should('have.length', 3);
  },
});
