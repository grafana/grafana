import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Dashboard timepicker',
  itName: 'Shows the correct calendar days with custom timezone set via preferences',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    //Make sure that the browser time zone is set to UTC
    //Open preferences page and set timezone to Tokyo
    e2e.pages.ProfilePage.visit();
    
    //Open dashboard with time range from 2022-06-08 00:00:00 to 2022-06-10 23:59:59
    e2e.flows.openDashboard({
      uid: '5SdHCasdf',
      timeRange: {
        from: '2022-06-08 00:00:00',
        to: '2022-06-10 23:59:59',
      },
    });
    //Open timepicker
    //Open calendar
    //Assert that the calendar shows 08, 09 and 10 as selected days
  },
});


