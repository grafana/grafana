import { loginAdmin } from "../../lib/api.js";
import { getDashboard, deleteDashboards } from "../../lib/dashboards.js";
import { provision } from "../../lib/grafana.js";
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
  return provision({ dashboards: { count: 1 }});
}

export default function(data) {
  loginAdmin();
  getDashboard(data.dashboards[0]).json();
}

// teardown runs only once after the test finishes
export function teardown(data) {
  loginAdmin();
  deleteDashboards([data.dashboards[0]]);
}

export function handleSummary(data) {
  return createSummaryFromData(data, "dashboard_read");
 }
