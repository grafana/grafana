import { gatherInfo } from "../lib/summary.js";

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

// minimal function used to test gatherInfo against running instance of grafana
// and test bench
export default function() {}
export function handleSummary() {
  const report = gatherInfo()
  console.log(JSON.stringify(report, null, "  "))
 }

