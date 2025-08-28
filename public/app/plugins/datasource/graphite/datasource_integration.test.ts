import { of } from 'rxjs';

import { BackendSrv, getBackendSrv, setBackendSrv } from '@grafana/runtime';

import { GraphiteDatasource } from './datasource';

interface Context {
  ds: GraphiteDatasource;
}

let origBackendSrv: BackendSrv;
describe('graphiteDatasource integration with backendSrv and fetch', () => {
  let ctx = {} as Context;

  beforeEach(() => {
    jest.clearAllMocks();
    origBackendSrv = getBackendSrv();
    const instanceSettings = {
      url: '/api/datasources/proxy/1',
      name: 'graphiteProd',
      jsonData: {
        rollupIndicatorEnabled: true,
      },
    };
    const ds = new GraphiteDatasource(instanceSettings);
    ctx = { ds };
  });

  afterEach(() => {
    setBackendSrv(origBackendSrv);
  });

  describe('returns a list of functions', () => {
    it('should return a list of functions with invalid JSON', async () => {
      const INVALID_JSON =
        '{"testFunction":{"name":"function","description":"description","module":"graphite.render.functions","group":"Transform","params":[{"name":"param","type":"intOrInf","required":true,"default":Infinity}]}}';
      setBackendSrv({ ...origBackendSrv, fetch: jest.fn().mockReturnValue(of({ data: INVALID_JSON })) });

      const funcDefs = await ctx.ds.getFuncDefs();

      expect(funcDefs).toEqual({
        testFunction: {
          category: 'Transform',
          defaultParams: ['inf'],
          description: 'description',
          fake: true,
          name: 'function',
          params: [
            {
              multiple: false,
              name: 'param',
              optional: false,
              options: undefined,
              type: 'int_or_infinity',
            },
          ],
        },
      });
    });

    it('should return a list of functions with valid JSON', async () => {
      const VALID_JSON =
        '{"testFunction":{"name":"function","description":"description","module":"graphite.render.functions","group":"Transform","params":[{"name":"param","type":"intOrInf","required":true,"default":1e9999}]}}';
      setBackendSrv({ ...origBackendSrv, fetch: jest.fn().mockReturnValue(of({ data: VALID_JSON })) });

      const funcDefs = await ctx.ds.getFuncDefs();

      expect(funcDefs).toEqual({
        testFunction: {
          category: 'Transform',
          defaultParams: ['inf'],
          description: 'description',
          fake: true,
          name: 'function',
          params: [
            {
              multiple: false,
              name: 'param',
              optional: false,
              options: undefined,
              type: 'int_or_infinity',
            },
          ],
        },
      });
    });
  });
});

// function mockBackendSrv(data: string) {
//   const defaults = {
//     data: '',
//     ok: true,
//     status: 200,
//     statusText: 'Ok',
//     isSignedIn: true,
//     orgId: 1337,
//     redirected: false,
//     type: 'basic',
//     url: 'http://localhost:3000/api/some-mock',
//   };

//   const props = { ...defaults };

//   props.data = data;

//   const textMock = jest.fn().mockResolvedValue(props.data);

//   const fromFetchMock = jest.fn().mockImplementation(() => {
//     const mockedResponse = {
//       ok: props.ok,
//       status: props.status,
//       statusText: props.statusText,
//       text: textMock,
//       redirected: false,
//       type: 'basic',
//       url: 'http://localhost:3000/api/some-mock',
//       headers: new Headers({
//         method: 'GET',
//         url: '/functions',
//         // to work around Graphite returning invalid JSON
//         responseType: 'text',
//       }),
//     };
//     return of(mockedResponse);
//   });

//   const appEventsMock = {} as EventBusExtended;

//   const user: User = {
//     isSignedIn: props.isSignedIn,
//     orgId: props.orgId,
//   } as unknown as User;
//   const contextSrvMock: ContextSrv = {
//     user,
//   } as unknown as ContextSrv;
//   const logoutMock = jest.fn();

//   const mockedBackendSrv = new BackendSrv({
//     fromFetch: fromFetchMock,
//     appEvents: appEventsMock,
//     contextSrv: contextSrvMock,
//     logout: logoutMock,
//   });

//   setBackendSrv(mockedBackendSrv);
// }
