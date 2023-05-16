import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { loginAdmin } from "../../lib/api.js";
import { createDashboard, updateDashboard, deleteDashboards } from "../../lib/dashboards.js";
import { rand } from "../../lib/util.js";
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
export function setup() {
  loginAdmin();
  return {
      dashboard: createDashboard(rand.uid()),
  };
}

export default function(data) {
  loginAdmin();
  let dashboard = data.dashboard
  // this will not change values in data.dashboard
  dashboard.content.title = randomString(15, "abcdefghijklmnopqrstuvxyz0123456789")

  // as long as this is a 200, we won't worry about checking the title
  updateDashboard(dashboard.content.uid, dashboard)
}

// teardown runs only once after the test finishes
export function teardown(data) {
  loginAdmin();
  deleteDashboards([data.dashboard]);
}

export function handleSummary(data) {
  return createSummaryFromData(data, "dashboard_update")
 }
