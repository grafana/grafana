import http from "k6/http";
import { check } from "k6";

import { url } from "../../lib/env.js";
import { loginAdmin } from "../../lib/api.js";
import { Orgs } from "../../lib/orgs.js";

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

// Running `k6 run tests/organizations/setup_teardown.js  -e ORG_NUM=5` in your terminal will create and delete 5 orgs.
export function setup() {
  loginAdmin();

  const orgs = Orgs.create(__ENV.ORG_NUM);

  return { orgs: orgs.orgIds };
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

  Orgs.del(data.orgs);
}
