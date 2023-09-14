import { e2e } from '../utils';

describe('Dashboard timepicker', () => {
  beforeEach(() => {
    e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
  });

  it('Shows the correct calendar days with custom timezone set via preferences', () => {
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
    cy.get('.react-calendar__tile--active, .react-calendar__tile--hasActive').should('have.length', 3);
  });

  it('Shows the correct calendar days with custom timezone set via time picker', () => {
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
    cy.get('.react-calendar__tile--active, .react-calendar__tile--hasActive').should('have.length', 3);
  });
});
