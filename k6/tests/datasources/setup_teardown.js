import http from "k6/http";
import { check } from "k6";

import { url } from "../../lib/env.js";
import { loginAdmin } from "../../lib/api.js";
import {
  createSpecificDatasource,
  deleteDatasource,
} from "../../lib/datasources.js";

export let options = {
  vus: 1,
  setupTimeout: "3m",
  duration: "1m",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
  noCookiesReset: true,
};

// Run `k6 run tests/datasources/setup_teardown.js -e DATASOURCE_NAME="prometheus"` in your terminal to create and delete a Prometheus datasource.
export function setup() {
  loginAdmin();

  // Create datasource.
  const datasourceUID = createSpecificDatasource(__ENV.DATASOURCE_NAME);

  return { uid: datasourceUID };
}

export default function (data) {
  loginAdmin();

  let res = http.get(url + "/api/user");
  check(res, {
    "is status 200": (r) => r.status === 200,
    "username is admin": (r) => r.json("login") === "admin",
  });
}

export function teardown(data) {
  loginAdmin();

  // Delete datasource.
  deleteDatasource(data.uid);
}
