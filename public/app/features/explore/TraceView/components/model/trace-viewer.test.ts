import { TraceSpan } from '../types/trace';

import { findHeaderTags } from './trace-viewer';

describe('findHeaderTags()', () => {
  it('return empty object when no spans are provided', () => {
    const spans: TraceSpan[] = [];
    expect(findHeaderTags(spans)).toEqual({});
  });

  it('return header tags when spans follow the OTEL semantic convention', () => {
    const spans: TraceSpan[] = [
      // @ts-ignore
      {
        tags: [
          { key: 'http.request.method', value: 'GET' },
          { key: 'http.response.status_code', value: '200' },
          { key: 'http.route', value: '/api/users' },
        ],
      },
    ];
    expect(findHeaderTags(spans)).toEqual({
      method: [{ key: 'http.request.method', value: 'GET' }],
      status: [{ key: 'http.response.status_code', value: '200' }],
      url: [{ key: 'http.route', value: '/api/users' }],
    });
  });

  it('return header tags when spans follow the alternative convention', () => {
    const spans: TraceSpan[] = [
      // @ts-ignore
      {
        tags: [
          { key: 'http.method', value: 'GET' },
          { key: 'http.status_code', value: '200' },
          { key: 'http.path', value: '/api/users' },
        ],
      },
      // @ts-ignore
      {
        tags: [
          { key: 'http.method', value: 'POST' },
          { key: 'http.status_code', value: '404' },
          { key: 'http.path', value: '/api/posts' },
        ],
      },
    ];
    expect(findHeaderTags(spans)).toEqual({
      method: [{ key: 'http.method', value: 'GET' }],
      status: [{ key: 'http.status_code', value: '200' }],
      url: [{ key: 'http.path', value: '/api/users' }],
    });
  });

  it('return header tags, prioritizing the spans that follow the OTEL semantinc convention', () => {
    const spans: TraceSpan[] = [
      // @ts-ignore
      {
        tags: [
          { key: 'http.method', value: 'GET' },
          { key: 'http.status', value: '200' },
          { key: 'http.path', value: '/api/users' },
        ],
      },
      // @ts-ignore
      {
        tags: [
          { key: 'http.request.method', value: 'POST' },
          { key: 'http.response.status_code', value: '404' },
          { key: 'http.route', value: '/api/users' },
        ],
      },
    ];
    expect(findHeaderTags(spans)).toEqual({
      method: [{ key: 'http.request.method', value: 'POST' }],
      status: [{ key: 'http.response.status_code', value: '404' }],
      url: [{ key: 'http.route', value: '/api/users' }],
    });
  });
});
