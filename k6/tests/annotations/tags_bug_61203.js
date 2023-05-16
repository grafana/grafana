// Reproduces https://github.com/grafana/grafana/issues/61203

import http from "k6/http";
import { check, randomSeed } from "k6";

import { url } from "../../lib/env.js";
import { loginAdmin } from "../../lib/api.js";
import { cleanup, provision } from "../../lib/grafana.js";

export let options = {
  vus: 10,
  duration: "20s",
  setupTimeout: "15s",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
  noCookiesReset: true,
};

// Setup runs only once and before the test starts.
export function setup() {
  loginAdmin();
  randomSeed(4);

  return provision({
    dashboards: {
      count: 1,
    },
  });
}

export default function (data) {
  loginAdmin();

  const ts = Math.floor(Date.now() / 100);
  const res = http.post(
    http.url`${url}/api/annotations`,
    JSON.stringify({
      dashboardUID: data.dashboards[0],
      time: Date.now(),
      timeEnd: Date.now() + 30000,
      tags: ["project=foo", `identifier=${ts}`],
      text: "Wrote an annotation",
    }),
    {
      tags: { type: "annotations", op: "create" },
      headers: { "Content-Type": "application/json" },
    }
  );

  check(res, {
    "annotation successfully created": (r) => r.status === 200,
    "creating annotation takes less than 150ms": (r) =>
      r.timings.duration < 150,
  });

  if (res.status >= 500) {
    console.log(res);
  }
}

// Teardown runs only once after the test finishes.
export function teardown(data) {
  loginAdmin();
  cleanup(data);
}
