import { EchoEventType, getEchoSrv } from '../../services/EchoSrv';

import { defineFeatureEvents } from './main';

jest.mock('../../services/EchoSrv');
jest.mock('../../config', () => ({
  config: {},
}));

const mockAddEvent = jest.fn();
jest.mocked(getEchoSrv).mockReturnValue({ addEvent: mockAddEvent } as unknown as ReturnType<typeof getEchoSrv>);

describe('defineFeatureEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEchoSrv).mockReturnValue({ addEvent: mockAddEvent } as unknown as ReturnType<typeof getEchoSrv>);
  });

  it('emits an interaction event with the prefixed name', () => {
    const factory = defineFeatureEvents('grafana', 'feature_x');
    const myEvent = factory('my_event');
    myEvent();

    expect(mockAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EchoEventType.Interaction,
        payload: expect.objectContaining({ interactionName: 'grafana_feature_x_my_event' }),
      })
    );
  });

  it('merges defaultProps into every event', () => {
    interface Props {
      [k: string]: string | number | boolean | null | undefined;
      foo: string;
    }
    const factory = defineFeatureEvents('grafana', 'feature_x', { schema_version: 1 });
    const myEvent = factory<Props>('my_event');
    myEvent({ foo: 'bar' });

    expect(mockAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          properties: { schema_version: 1, foo: 'bar' },
        }),
      })
    );
  });

  it('does not pass silent by default', () => {
    const factory = defineFeatureEvents('grafana', 'feature_x');
    const myEvent = factory('my_event');
    myEvent();

    expect(mockAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ silent: undefined }),
      })
    );
  });

  it('marks every event as silent when factory options.silent = true', () => {
    const factory = defineFeatureEvents('grafana', 'feature_x', undefined, { silent: true });
    const eventA = factory('a');
    const eventB = factory('b');
    eventA();
    eventB();

    expect(mockAddEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payload: expect.objectContaining({ interactionName: 'grafana_feature_x_a', silent: true }),
      })
    );
    expect(mockAddEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        payload: expect.objectContaining({ interactionName: 'grafana_feature_x_b', silent: true }),
      })
    );
  });

  it('does not pass silent when factory options.silent = false', () => {
    const factory = defineFeatureEvents('grafana', 'feature_x', undefined, { silent: false });
    const myEvent = factory('my_event');
    myEvent();

    expect(mockAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ silent: undefined }),
      })
    );
  });

  it('per-event silent: true overrides factory-level silent: false', () => {
    const factory = defineFeatureEvents('grafana', 'feature_x', undefined, { silent: false });
    const loud = factory('loud');
    const silent = factory('silent', { silent: true });
    loud();
    silent();

    expect(mockAddEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payload: expect.objectContaining({ interactionName: 'grafana_feature_x_loud', silent: undefined }),
      })
    );
    expect(mockAddEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        payload: expect.objectContaining({ interactionName: 'grafana_feature_x_silent', silent: true }),
      })
    );
  });

  it('per-event silent: false overrides factory-level silent: true', () => {
    const factory = defineFeatureEvents('grafana', 'feature_x', undefined, { silent: true });
    const loud = factory('loud', { silent: false });
    const silent = factory('silent');
    loud();
    silent();

    expect(mockAddEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payload: expect.objectContaining({ interactionName: 'grafana_feature_x_loud', silent: undefined }),
      })
    );
    expect(mockAddEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        payload: expect.objectContaining({ interactionName: 'grafana_feature_x_silent', silent: true }),
      })
    );
  });
});
