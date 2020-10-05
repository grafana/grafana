import { e2e } from '../index';
import { selectOption } from './selectOption';

export interface TimeRangeConfig {
  from: string;
  to: string;
  zone?: string;
}

export const setTimeRange = ({ from, to, zone }: TimeRangeConfig) => {
  e2e()
    .get('[aria-label="TimePicker Open Button"]')
    .click();

  if (zone) {
    e2e()
      .contains('button', 'Change time zone')
      .click();

    selectOption({
      clickToOpen: false,
      container: e2e.components.TimeZonePicker.container(),
      optionText: zone,
    });
  }

  // For smaller screens
  e2e()
    .get('[aria-label="TimePicker absolute time range"]')
    .click();

  e2e()
    .get('[aria-label="TimePicker from field"]')
    .clear()
    .type(from);
  e2e()
    .get('[aria-label="TimePicker to field"]')
    .clear()
    .type(to);
  e2e()
    .get('[aria-label="TimePicker submit button"]')
    .click();
};
