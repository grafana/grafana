import moment from 'moment/moment';
import { activeCheckStub } from 'app/percona/check/__mocks__/stubs';
import { makeSilencePayload } from './SilenceAlertButton.utils';

const TEST_USER = 'testUser';

(window as any).grafanaBootData = {
  user: {
    name: TEST_USER,
  },
};

describe('SilenceAlertButton.utils::', () => {
  it('should return a valid payload for the alert silencing API', () => {
    const { labels } = activeCheckStub[0].details[0];

    const expectedMatchers = [
      { name: 'agent_id', value: 'pmm-server', isRegex: false },
      { name: 'agent_type', value: 'pmm-agent', isRegex: false },
      { name: 'alertname', value: 'pmm_agent_outdated', isRegex: false },
      { name: 'node_id', value: 'pmm-server', isRegex: false },
      { name: 'node_name', value: 'pmm-server', isRegex: false },
      { name: 'node_type', value: 'generic', isRegex: false },
      { name: 'service_name', value: 'sandbox-mysql.acme.com', isRegex: false },
      { name: 'severity', value: 'error', isRegex: false },
      { name: 'stt_check', value: '1', isRegex: false },
    ];

    const realDateNow = Date.now;

    Date.now = jest.fn(() => 1595163832705);

    const nowUTCISO = moment.utc().format();
    const tomorrowUTCISO = moment
      .utc()
      .add(24, 'hours')
      .format();

    const silencePayload = makeSilencePayload(labels);

    expect(silencePayload.matchers).toEqual(expectedMatchers);
    expect(silencePayload.startsAt).toEqual(nowUTCISO);
    expect(silencePayload.endsAt).toEqual(tomorrowUTCISO);
    expect(silencePayload.createdBy).toEqual(TEST_USER);
    expect(silencePayload.comment).toEqual('');
    expect(silencePayload.id).toEqual('');

    Date.now = realDateNow;
  });
});
