import { createTheme } from '@grafana/data';

import {getBarColorByPackage, getBarColorByValue, getPackageName} from './colors';

describe('getBarColorByValue', () => {
  it('converts value to color', () => {
    expect(getBarColorByValue(1, 100, 0, 1).toHslString()).toBe('hsl(50, 100%, 65%)');
    expect(getBarColorByValue(100, 100, 0, 1).toHslString()).toBe('hsl(0, 100%, 72%)');
    expect(getBarColorByValue(10, 100, 0, 0.1).toHslString()).toBe('hsl(0, 100%, 72%)');
  });
});

describe('getBarColorByPackage', () => {
  it('converts package to color', () => {
    const theme = createTheme();
    const c = getBarColorByPackage('net/http.HandlerFunc.ServeHTTP', theme);
    expect(c.toHslString()).toBe('hsl(246, 40%, 65%)');
    // same package should have same color
    expect(getBarColorByPackage('net/http.(*conn).serve', theme).toHslString()).toBe(c.toHslString());

    expect(getBarColorByPackage('github.com/grafana/phlare/pkg/util.Log.Wrap.func1', theme).toHslString()).toBe(
      'hsl(105, 40%, 76%)'
    );
  });
});
describe('getPackageName', () => {
  describe('golang', () => {
    describe.each([
      ['bufio.(*Reader).fill', 'bufio.'],
      ['cmpbody', 'cmpbody'],
      ['bytes.Compare', 'bytes.'],
      ['crypto/tls.(*Conn).clientHandshake', 'crypto/tls.'],
      [
        'github.com/DataDog/zstd._Cfunc_ZSTD_compress_wrapper',
        'github.com/DataDog/zstd.',
      ],
      [
        'github.com/dgraph-io/badger/v2.(*DB).calculateSize',
        'github.com/dgraph-io/badger/v2.',
      ],
      [
        'github.com/dgraph-io/badger/v2/table.(*blockIterator).next',
        'github.com/dgraph-io/badger/v2/table.',
      ],
      ['path/filepath.walk', 'path/filepath.'],
      ['os.(*File).write', 'os.'],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('dotnetspy', () => {
    describe.each([
      ['total', 'total'],
      [
        'System.Private.CoreLib!System.Threading.TimerQueue.FireNextTimers()',
        'System.Private.CoreLib!System.Threading',
      ],
      [
        'StackExchange.Redis!StackExchange.Redis.ConnectionMultiplexer.OnHeartbeat()',
        'StackExchange.Redis!StackExchange.Redis',
      ],
      [
        'Microsoft.AspNetCore.Server.Kestrel.Core!Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http.HttpRequestPipeReader.ReadAsync(value class System.Threading.CancellationToken)',
        'Microsoft.AspNetCore.Server.Kestrel.Core!Microsoft.AspNetCore.Server.Kestrel.Core.Internal.Http',
      ],
      [
        'Google.Protobuf!Google.Protobuf.ParsingPrimitivesMessages.ReadRawMessage(value class Google.Protobuf.ParseContext\u0026,class Google.Protobuf.IMessage)',
        'Google.Protobuf!Google.Protobuf',
      ],
      [
        'Grpc.AspNetCore.Server!Grpc.AspNetCore.Server.Internal.PipeExtensions.ReadSingleMessageAsync(class System.IO.Pipelines.PipeReader,class Grpc.AspNetCore.Server.Internal.HttpContextServerCallContext,class System.Func`2\u003cclass Grpc.Core.DeserializationContext,!!0\u003e)',
        'Grpc.AspNetCore.Server!Grpc.AspNetCore.Server.Internal',
      ],
      [
        'System.Private.CoreLib!System.Runtime.CompilerServices.AsyncTaskMethodBuilder`1[System.__Canon].GetStateMachineBox(!!0\u0026,class System.Threading.Tasks.Task`1\u003c!0\u003e\u0026)',
        'System.Private.CoreLib!System.Runtime.CompilerServices.AsyncTaskMethodBuilder`1[System',
      ],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('pyspy', () => {
    describe.each([
      ['total', 'total'],
      ['urllib3/response.py:579 - stream', 'urllib3/'],
      ['requests/models.py:580 - prepare_cookies', 'requests/'],
      ['logging/__init__.py:1548 - findCaller', 'logging/'],
      [
        'jaeger_client/thrift_gen/jaeger/ttypes.py:147 - write',
        'jaeger_client/thrift_gen/jaeger/',
      ],

      // TODO: this one looks incorrect, but keeping in the test for now
      [
        '\u003cfrozen importlib._bootstrap\u003e:1030 - _gcd_import',
        '<frozen importlib._bootstrap>:1030 - _gcd_import',
      ],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('rbspy', () => {
    describe.each([
      ['total', 'total'],
      ['webrick/utils.rb:194 - watch', 'webrick/'],
      ['webrick/server.rb:190 - block (2 levels) in start', 'webrick/'],
      [
        'gems/sinatra-2.0.3/lib/sinatra/base.rb:1537 - start_server',
        'gems/sinatra-2.0.3/lib/sinatra/',
      ],
      ['services/driver/client.rb:34 - get_drivers', 'services/driver/'],
      ['uri/common.rb:742 - URI', 'uri/'],
      ['net/protocol.rb:299 - block in write0', 'net/'],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('ebpfspy', () => {
    describe.each([
      ['total', 'total'],
      ['entry_SYSCALL_64_after_hwframe', 'entry_SYSCALL_64_after_hwframe'],
      ['[unknown]', '[unknown]'],
      [
        'QApplicationPrivate::notify_helper(QObject*, QEvent*)',
        'QApplicationPrivate::notify_helper(QObject*, QEvent*)',
      ],
      [
        'v8::internal::(anonymous namespace)::Invoke(v8::internal::Isolate*, v8::internal::(anonymous namespace)::InvokeParams const&)',
        'v8::internal::(anonymous namespace)::Invoke(v8::internal::Isolate*, v8::internal::(anonymous namespace)::InvokeParams const&)',
      ],
      [
        'github.com/pyroscope-io/pyroscope/pkg/agent.(*ProfileSession).Start.dwrap.3',
        'github.com/pyroscope-io/pyroscope/pkg/agent.(*ProfileSession).Start.dwrap.3',
      ],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('default', () => {
    describe.each([
      ['total', 'total'],
      ['entry_SYSCALL_64_after_hwframe', 'entry_SYSCALL_64_after_hwframe'],
      ['[unknown]', '[unknown]'],
      [
        'QApplicationPrivate::notify_helper(QObject*, QEvent*)',
        'QApplicationPrivate::notify_helper(QObject*, QEvent*)',
      ],
      [
        'v8::internal::(anonymous namespace)::Invoke(v8::internal::Isolate*, v8::internal::(anonymous namespace)::InvokeParams const&)',
        'v8::internal::(anonymous namespace)::Invoke(v8::internal::Isolate*, v8::internal::(anonymous namespace)::InvokeParams const&)',
      ],
      [
        'github.com/pyroscope-io/pyroscope/pkg/agent.(*ProfileSession).Start.dwrap.3',
        'github.com/pyroscope-io/pyroscope/pkg/agent.(*ProfileSession).Start.dwrap.3',
      ],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('rust', () => {
    describe.each([
      ['total', 'total'],
      ['std::thread::local::LocalKey<T>::with', 'std'],
      [
        'tokio::runtime::basic_scheduler::CoreGuard::block_on::{{closure}}::{{closure}}::{{closure}}',
        'tokio',
      ],
      [
        '<core::future::from_generator::GenFuture<T> as core::future::future::Future>::poll',
        '<core',
      ],
      [
        'reqwest::blocking::client::ClientHandle::new::{{closure}}::{{closure}}',
        'reqwest',
      ],
      ['core::time::Duration::as_secs', 'core'],
      ['clock_gettime@GLIBC_2.2.5', 'clock_gettime@GLIBC_2.2.5'],
      [
        'hyper::proto::h1::dispatch::Dispatcher<D,Bs,I,T>::poll_catch debugger eval code',
        'hyper',
      ],
      ['openssl::ssl::connector::SslConnector::builder', 'openssl'],

      // TODO looks incorrect
      [
        '<F as futures_core::future::TryFuture>::try_poll',
        '<F as futures_core',
      ],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('scrape (pull mode)', () => {
    describe.each([
      ['bufio.(*Reader).fill', 'bufio.'],
      ['cmpbody', 'cmpbody'],
      ['bytes.Compare', 'bytes.'],
      ['crypto/tls.(*Conn).clientHandshake', 'crypto/tls.'],
      [
        'github.com/DataDog/zstd._Cfunc_ZSTD_compress_wrapper',
        'github.com/DataDog/zstd.',
      ],
      [
        'github.com/dgraph-io/badger/v2.(*DB).calculateSize',
        'github.com/dgraph-io/badger/v2.',
      ],
      [
        'github.com/dgraph-io/badger/v2/table.(*blockIterator).next',
        'github.com/dgraph-io/badger/v2/table.',
      ],
      ['path/filepath.walk', 'path/filepath.'],
      ['os.(*File).write', 'os.'],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('nodejs spy', () => {
    describe.each([
      ['total', 'total'],
      ['./node_modules/node-fetch/lib/index.js:fetch:1493', 'node-fetch'],
      [
        './node_modules/@pyroscope-node/dist/pull/index.js:sampleFunction:1827',
        '@pyroscope-node',
      ],
      ['node:net:Socket:320', 'node:net'],
      [':(idle):0', ''],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });

  describe('java spy', () => {
    describe.each([
      [
        'org/apache/catalina/core/ApplicationFilterChain.doFilter',
        'org/apache/catalina/core/',
      ],
      [
        'org/apache/catalina/core/ApplicationFilterChain.internalDoFilter',
        'org/apache/catalina/core/',
      ],
      [
        'org/apache/coyote/AbstractProcessorLight.process',
        'org/apache/coyote/',
      ],
      [
        'org/springframework/web/servlet/DispatcherServlet.doService',
        'org/springframework/web/servlet/',
      ],
      [
        'org/example/rideshare/RideShareController.orderCar',
        'org/example/rideshare/',
      ],
      ['org/example/rideshare/OrderService.orderCar', 'org/example/rideshare/'],
      ['total', 'total'],
    ])(`.getPackageNameFromStackTrace('%s')`, (a, expected) => {
      it(`returns '${expected}'`, () => {
        expect(getPackageName(a)).toBe(expected);
      });
    });
  });
});
