import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { loginAdmin } from "../../lib/api.js";
import { getDashboard, createDashboard, updateDashboard, deleteDashboard } from "../../lib/dashboards.js";
import { rand } from "../../lib/util.js";
import { check} from "k6";
import { createSummaryFromData } from "../../lib/summary.js";

export let options = {
  vus: 7,
  duration: "30s",
  setupTimeout: "3m",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
  noCookiesReset: true,
};

// setup runs only once and before the test starts
export function setup() {}

// TODO preliminary results are showing less deletes occurring than creates or
// updates. When the test stops running, does it cut off this method regardless
// of if it finished? If so, we need to reset the grafana db.
export default function() {
  loginAdmin();

  // create
  const uid = rand.uid();
  let dashboard = createDashboard(uid);

  // read dashboard and verify title
  let getRes = getDashboard(uid).json();
  check(getRes, {
    [`created dashboard title is ${dashboard.content.title} `]: (r) => r.dashboard.title === dashboard.content.title,
  });

  // update title
  dashboard.content["title"] = randomString(15, "abcdefghijklmnopqrstuvxyz0123456789")
  updateDashboard(uid, dashboard)

  // read dashboard and verify updated title
  let getUpdatedRes = getDashboard(uid).json();
  check(getUpdatedRes, {
    [`updated dashboard title is ${dashboard.content.title}`]: (r) => r.dashboard.title === dashboard.content.title,
  });

  // delete dashboard
  deleteDashboard(uid);
  getDashboard(uid, 404);
}

// teardown runs only once after the test finishes
export function teardown() {}

export function handleSummary(data) {
  return createSummaryFromData(data, "dashboard_crud")
 }
