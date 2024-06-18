import { e2e } from '../index';

import { selectOption } from './selectOption';

export interface TimeRangeConfig {
  from: string;
  to: string;
  zone?: string;
}

export const setTimeRange = ({ from, to, zone }: TimeRangeConfig) => {
  e2e.components.TimePicker.openButton().click();

  if (zone) {
    cy.contains('button', 'Change time settings').click();
    cy.log('setting time zone to ' + zone);

    if (e2e.components.TimeZonePicker.containerV2) {
      selectOption({
        clickToOpen: true,
        container: e2e.components.TimeZonePicker.containerV2(),
        optionText: zone,
      });
    } else {
      selectOption({
        clickToOpen: true,
        container: e2e.components.TimeZonePicker.container(),
        optionText: zone,
      });
    }
  }

  // For smaller screens
  e2e.components.TimePicker.absoluteTimeRangeTitle().click();

  e2e.components.TimePicker.fromField().clear().type(from);
  e2e.components.TimePicker.toField().clear().type(to);

  e2e.components.TimePicker.applyTimeRange().click();
};
