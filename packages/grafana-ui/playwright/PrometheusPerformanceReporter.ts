import type { Reporter, FullConfig, Suite, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { pushTimeseries } from 'prometheus-remote-write';

const config = {
  url: process.env.PERF_TEST_PROMETHEUS_URL || 'http://localhost:9090',
  auth: {
    username: process.env.PERF_TEST_PROMETHEUS_USERNAME,
    password: process.env.PERF_TEST_PROMETHEUS_PASSWORD,
  },
};

class PrometheusReporter implements Reporter {
  constructor() {}

  onBegin(config: FullConfig, suite: Suite) {
    console.log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase) {
    console.log(`Starting test ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    console.log(config);

    test.annotations.forEach((annotation) => {
      if (!annotation.type.startsWith('perf_test_')) {
        return;
      }
      const value = Number(annotation.description);

      console.log(annotation.type, value);
      pushTimeseries(
        {
          labels: {
            __name__: annotation.type,
            test: test.title,
          },
          samples: [
            {
              value: value,
              timestamp: Date.now(),
            },
          ],
        },
        config
      )
        .then((res) => console.log(res))
        .catch(console.error);
      console.log(`Pushed ${annotation.type} for ${test.title}`);
    });

    console.log(test.retries);

    console.log(`Finished test ${test.title}: ${result.status}`);
  }

  onEnd(result: FullResult) {
    console.log(`Finished the run: ${result.status}`);
  }
}
export default PrometheusReporter;
