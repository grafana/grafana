import { check, randomSeed } from "k6";
import http from "k6/http";

import { loginAdmin, login } from "../../lib/api.js";
import { url } from "../../lib/env.js";
import { cleanup, provision } from "../../lib/grafana.js";
import { rand } from "../../lib/util.js";

export let options = {
  vus: 7,
  duration: "30s",
  setupTimeout: "3m",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
};

// Setup runs only once and before the test starts.
export function setup() {
  loginAdmin();
  randomSeed(4);

  return provision({
    users: {
      viewers: 20,
    },
    dashboards: {
      count: 120,
    },
  });
}

// Test function, each virtual user (VU) runs one instance of this over and over.
export default function (data) {
  const u = rand.select(data.users);
  login(u.login, u.password, true);

  // Search is a heavy query. That's why it's fun.
  const res = http.get(url + "/api/search?q=k6", {
    tags: { type: "search", op: "search" },
  });
  check(res, {
    "search has status 200": (r) => r.status === 200,
    "search takes less than 1s": (r) => r.timings.duration < 1000,
    "dashboards found": (r) => r.json().length !== 0,
  });
}

// Teardown runs only once after the test finishes.
export function teardown(data) {
  loginAdmin();
  cleanup(data);
}
