import { pageFactory } from '../support';

export const DataSource = pageFactory({
  url: '',
  selectors: {
    name: 'Data source settings page name input field',
    delete: 'Data source settings page Delete button',
    saveAndTest: 'Data source settings page Save and Test button',
    alert: 'Data source settings page Alert',
    alertMessage: 'Data source settings page Alert message',
  },
});
