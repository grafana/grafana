import http from "k6/http";
import { check } from "k6";

import { url } from "./env.js";
import { devDashboards } from "./dashboards_gen.js";
import { rand } from "./util.js";

/**
 * Creates a set number of dashboards and distributes them randomly across folders.
 *
 * @param {number} num Number of dashboards to generate.
 * @param {string[]} [folderUids] List of folders to randomly place newly created dashboards in.
 * @returns {string[]} List of UIDs for the newly created dashboards (including dashboards that couldn't be created).
 */
export function createDashboards(num, folderUids = []) {
  console.info(`creating ${num} dashboards...`);

  const dashboards = [];

  rand.strings(dashboards, num);

  // Create a dashboard per UID. Skipping batches because Grafana doesn't deal well with MySQL locks and creating many dashboards fast at the moment.
  dashboards.forEach((d) => createDashboard(d, rand.select(folderUids)));
  return dashboards;
}

/**
 * Gets a dashboard using the '/api/dashboards/uid/:uid' API and validates that the correct status/dashboard is returned.
 *
 * @param {string} uid Unique identifier for the dashboard.
 * @param {number} [expectedStatusCode] The HTTP status code expected from Grafana.
 * @returns {*} The raw k6 HTTP response for the API call.
 */
export function getDashboard(uid, expectedStatusCode = 200) {
  const res = http.get(
    http.url`${url}/api/dashboards/uid/${uid}`,
    {
      tags: { type: "dashboards", op:"read" },
    }
  );

  check(res, {
    [`get dashboard status is ${expectedStatusCode}`]: (r) => r.status === expectedStatusCode,
  });

  if (res.status !== expectedStatusCode) {
    console.warn(
      `failed to get dashboard '${uid}', got HTTP status ${
        res.status
      } with error: ${res.json("message")}`
    );
  }

  // verify we got the correct object back if successfull response
  if(res.status === 200) {
    check(res, {[`get correct dashboard ${uid}`]: (r) => r.json().dashboard.uid === uid});
  }

  return res
}

/**
 * Create one dashboard with the provided UID.
 * The content of the dashboard is randomized between a number of different possible dashboards provided by dashboards_gen.js.
 *
 * @param {string} uid Unique identifier for the dashboard.
 * @param {string} [folderUid] The unique identifier for the folder within which to place the dashboard.
 * @returns {{name: string, content: *}} Returns the raw dashboard as it was inserted into the database.
 */
export function createDashboard(uid, folderUid) {
  const db = randomDashboardJSON(uid);

  // TODO unsure if I still need to remove version
  delete db.content.version;

  const res = http.post(
    http.url`${url}/api/dashboards/db`,
    JSON.stringify({ dashboard: db.content, folderUid: folderUid }),
    {
      tags: { type: "dashboards", op: "create" },
      headers: { "Content-Type": "application/json" },
    }
  );

  check(res, {
    "create dashboard status is 200": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.warn(
      `failed to create dashboard '${uid}', got HTTP status ${
        res.status
      } with error: ${res.json("message")}`
    );
  }

  // verify we got the correct object back
  check(res, {[`get correct dashboard ${uid}`]: (r) => r.json().uid === uid});

  // TODO maybe this should return the response, not the dashboard and this
  // method should take a dashboard
  return db;
}

/**
 *
 * @param {string} uid Unique identifier for the dashboard.
 * @param {{content: *}} db New dashboard model.
 * @returns {*} Returns the db parameter.
 */
export function updateDashboard(uid, db) {
  let res = http.post(
    http.url`${url}/api/dashboards/db`,
    JSON.stringify({ dashboard: db.content, folderUid: "", overwrite: true}),
    {
      tags: { type: "dashboards", op: "update" },
      headers: { "Content-Type": "application/json" },
    }
  );

  check(res, {
    "update dashboard status is 200": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.warn(
      `failed to update dashboard '${uid}', got HTTP status ${
        res.status
      } with error: ${res.json("message")}`
    );
  }

  // verify we got the correct object back
  check(res, {[`get correct dashboard ${uid}`]: (r) => r.json().uid === uid});

  return db;

}

/**
 * Deletes a dashboard based on the provided identifier.
 *
 * @param {string} uid Unique identifier for the dashboard.
 */
export function deleteDashboard(uid) {
  const res = http.del(http.url`${url}/api/dashboards/uid/${uid}`, null, {
      tags: { type: "dashboards", op: "delete" },
    });

    check(res, {
      "delete dashboard status is 200": (r) => r.status === 200,
    });
}

/**
 * Deletes multiple dashboards by providing a list of unique identifiers.
 *
 * @param {string[]} dashboards List of unique identifiers for dashboards to delete.
 */
export function deleteDashboards(dashboards) {
  console.info(`deleting ${dashboards.length} dashboards...`);
  dashboards.forEach((d) => { deleteDashboard(d) });
}

// Create a dashboard JSON from a set of sample dashboards.
function randomDashboardJSON(uid) {
  const i = Math.floor(Math.random() * devDashboards.length);
  let db = devDashboards[i];
  db.content["uid"] = uid; // Setting our UID.
  db.content["title"] = "k6 dashboard " + uid; // Title needs to be unique.
  delete db.content["id"]; // if ID is set, Grafana thinks this is an update.
  return db;
}
