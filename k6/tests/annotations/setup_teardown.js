import { loginAdmin } from "../../lib/api.js";
import { annotations } from "../../lib/annotations.js";
import { provision, cleanup } from "../../lib/grafana.js";
import { rand } from "../../lib/util.js";

export let options = {
  setupTimeout: "15s",
  duration: "30s",
  noCookiesReset: true,
};

export function setup() {
  loginAdmin();
  return provision({
    dashboards: { count: 10 },
  });
}

export default function (data) {
  loginAdmin();

  // Create tags.
  const tags = ["tag1", "tag2", "tag3"];
  const id = annotations.createInDashboard(rand.select(data.dashboards), rand.slice(tags, 1, tags.length), "Hello, annotation!");
  annotations.del(id);
}

export function teardown(data) {
  loginAdmin();
  cleanup(data);
}
