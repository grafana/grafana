import { TimeRange } from '@grafana/data';
import { RelatedProfilesTitle } from '@grafana-plugins/tempo/resultTransformer';

import { SpanLinkType } from '../../types/links';
import { TraceSpan } from '../../types/trace';

import { getSpanDetailLinkButtons, getProfileLinkButtonsContext } from './SpanDetailLinkButtons';

const span = {
  process: {
    serviceName: 'test-service',
  },
  tags: [{ key: 'pyroscope.profile.id', value: 'test-profile' }],
} as TraceSpan;

const createSpanLink = jest.fn();
const timeRange = {
  from: new Date(0),
  to: new Date(1000),
} as unknown as TimeRange;

describe('getSpanDetailLinkButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty buttons when createSpanLink is not provided', () => {
    const result = getSpanDetailLinkButtons({
      span,
      createSpanLink: undefined,
      datasourceType: 'test',
      traceToProfilesOptions: undefined,
      timeRange,
    });

    expect(result.logLinkButton).toBeNull();
    expect(result.profileLinkButtons).toBeNull();
    expect(result.sessionLinkButton).toBeNull();
  });

  it('should create log link button when logs link exists', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Logs, href: '/logs', title: 'Logs' }]);

    const result = getSpanDetailLinkButtons({
      span,
      createSpanLink,
      datasourceType: 'test',
      traceToProfilesOptions: undefined,
      timeRange,
    });

    expect(result.logLinkButton).toBeDefined();
    expect(result.profileLinkButtons).toBeNull();
    expect(result.sessionLinkButton).toBeNull();
  });

  it('should create profile link button when profiles link exists', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Profiles, href: '/profiles', title: RelatedProfilesTitle }]);

    const result = getSpanDetailLinkButtons({
      span,
      createSpanLink,
      datasourceType: 'test',
      traceToProfilesOptions: {
        datasourceUid: 'test-uid',
        profileTypeId: 'test-type',
        customQuery: false,
      },
      timeRange,
    });

    expect(result.logLinkButton).toBeNull();
    expect(result.profileLinkButtons).toBeDefined();
    expect(result.sessionLinkButton).toBeNull();
  });

  it('should create session link button when session link exists', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Session, href: '/session', title: 'Session' }]);

    const result = getSpanDetailLinkButtons({
      span,
      createSpanLink,
      datasourceType: 'test',
      traceToProfilesOptions: undefined,
      timeRange,
    });

    expect(result.logLinkButton).toBeNull();
    expect(result.profileLinkButtons).toBeNull();
    expect(result.sessionLinkButton).toBeDefined();
  });
});

describe('getProfileLinkButtonsContext', () => {
  const traceToProfilesOptions = {
    datasourceUid: 'test-uid',
    profileTypeId: 'test-type',
    customQuery: false,
  };

  it('should create context with all properties', () => {
    const context = getProfileLinkButtonsContext(span, traceToProfilesOptions, timeRange);

    expect(context).toEqual({
      serviceName: 'test-service',
      profileTypeId: 'test-type',
      spanSelector: 'test-profile',
      explorationType: 'flame-graph',
      timeRange: {
        from: new Date(0).toISOString(),
        to: new Date(1000).toISOString(),
      },
      targets: [
        {
          datasource: {
            type: 'grafana-pyroscope-datasource',
            uid: 'test-uid',
          },
        },
      ],
    });
  });

  it('should handle missing traceToProfilesOptions', () => {
    const context = getProfileLinkButtonsContext(span, undefined, timeRange);

    expect(context).toEqual({
      serviceName: 'test-service',
      profileTypeId: '',
      spanSelector: 'test-profile',
      explorationType: 'flame-graph',
      timeRange: {
        from: new Date(0).toISOString(),
        to: new Date(1000).toISOString(),
      },
      targets: [
        {
          datasource: {
            type: 'grafana-pyroscope-datasource',
            uid: undefined,
          },
        },
      ],
    });
  });

  it('should handle missing service name', () => {
    const spanWithoutService = {
      process: {},
      tags: [{ key: 'pyroscope.profile.id', value: 'test-profile' }],
    } as TraceSpan;

    const context = getProfileLinkButtonsContext(spanWithoutService, traceToProfilesOptions, timeRange);

    expect(context.serviceName).toBe('');
  });

  it('should handle missing profile ID tag', () => {
    const spanWithoutProfileId = {
      process: { serviceName: 'test-service' },
      tags: [],
    } as unknown as TraceSpan;

    const context = getProfileLinkButtonsContext(spanWithoutProfileId, traceToProfilesOptions, timeRange);

    expect(context.spanSelector).toBe('');
  });
});
