import http from "k6/http";
import { check } from "k6";

import { url } from "../../lib/env.js";
import { createFolders, deleteFolders } from "../../lib/folders.js";
import { loginAdmin } from "../../lib/api.js";
import { createDashboards } from "../../lib/dashboards.js";

export let options = {
  vus: 1,
  setupTimeout: "5m",
  duration: "1m",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
  noCookiesReset: true,
};

export function setup() {
  loginAdmin();

  const folders = createFolders(__ENV.PARENT_FOLDER_NUM);
  const dashboards = createDashboards(__ENV.DASHBOARD_NUM, folders.folderUIDs);

  return { folders: folders.folderUIDs, parents: folders.parentUIDs };
}

export default function (data) {
  loginAdmin();

  res = http.get(url + "/api/search?q=k6");
  check(res, {
    "search status is 200": (r) => r.status === 200,
    "response takes less than 1s": (r) => r.timings.duration < 1000,
  });
}

export function teardown(data) {
  loginAdmin();

  deleteFolders(data.parents);
}
