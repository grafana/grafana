import { getFrontendSettings, getGrafanaBuildInfo, getMachineSpec } from "./env.js";

// exported so we can test this
export function gatherInfo() {
  const machineSpec = getMachineSpec();
  const grafanaBuildInfo = getGrafanaBuildInfo(); // reported from metrics
  const { featureToggles, buildInfo } = getFrontendSettings(); // reported from frontend

  // merge fields not included metrics build info
  grafanaBuildInfo["latestVersion"] = buildInfo["latestVersion"]
  grafanaBuildInfo["env"] = buildInfo["env"]
  grafanaBuildInfo["buildstamp"] = buildInfo["buildstamp"]
  grafanaBuildInfo["edition"] = buildInfo["edition"]

  return {
    machineSpec,
    grafanaBuildInfo,
    testconfiguration:{
      testSuite: {
        revision: __ENV.TEST_SUITE_REVISION,
      },
      // TODO figure out best way to get database configuration info either from
      // grafana or grafana-bench
      database: {
        provider: "local",
        driver: "sqlite",
      },
      featureToggles,
    }
  }
}

export function createSummaryFromData(data, name) {
  let filename = `summary_${name}.json`
  if (__ENV.TEST_SUMMARY_DIR) {
    filename = `${__ENV.TEST_SUMMARY_DIR}/${filename}`
  }

  let testMeta = gatherInfo()

    const report = {
      testMeta,
      results: {
        name,
        duration: data.state.testRunDurationMs,
        iterations: data.metrics.iterations.values.count,
        http_req_failed_rate: data.metrics.http_req_failed.values.rate,
        checks_success_rate: data.metrics.checks.values.rate,
      },
    };

    return {
      'stdout': JSON.stringify(report, null, "  "),
      [filename]: JSON.stringify(report, null, "  "),
    };
  }

