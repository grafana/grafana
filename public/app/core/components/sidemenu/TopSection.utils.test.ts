import config from '../../config';
import { buildIntegratedAlertingMenuItem } from './TopSection.utils';

describe('TopSection.utils', () => {
  const testMenu = [
    {
      id: 'alerting',
      text: 'Alerting',
      children: [
        {
          id: 'test',
          text: 'test',
        },
      ],
    },
  ];

  it('should return menu item with integrated alerting on top', () => {
    const result = buildIntegratedAlertingMenuItem(testMenu)[0].children;
    const integratedAlertingLink = {
      id: 'integrated-alerting',
      text: 'Integrated Alerting',
      icon: 'list-ul',
      url: `${config.appSubUrl}/integrated-alerting`,
    };
    const divider = {
      id: 'divider',
      text: 'Divider',
      divider: true,
      hideFromTabs: true,
    };

    expect(result.length).toBe(3);
    expect(result[0]).toEqual(integratedAlertingLink);
    expect(result[1]).toEqual(divider);
  });
});
