import http from "k6/http";
import { check } from "k6";

import { url } from "./env.js";
import { rand } from "./util.js";

/**
 * Creates a data source in Grafana with the given type.
 * The data source is setup with localhost:25519 as its target URL and will not be functional.
 *
 * @param {string} tpe The type for the created data source.
 * @returns {string} Unique identifier for the newly created data source.
 */
export function createSpecificDatasource(tpe) {
  console.info(`creating ${tpe} datasource...`);
  let res = http.post(
    url + "/api/datasources",
    JSON.stringify(datasourceJSON(tpe)),
    {
      tags: "create",
      headers: { "Content-Type": "application/json" },
    }
  );
  check(res, {
    "create datasource status is 200": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.warn(
      `failed to create ${tpe} datasource, got HTTP status ${
        res.status
      } with error: ${res.json("message")}`
    );
  }

  return res.json("datasource.uid");
}

/**
 * Deletes the provided data source.
 *
 * @param {string} uid Unique identifier for the data source.
 */
export function deleteDatasource(uid) {
  console.info(`deleting datasource...`);

  const res = http.del(url + "/api/datasources/uid/" + uid, null, {
    tags: { op: "delete" },
  });

  check(res, {
    "delete datasource status is status 200": (r) => r.status === 200,
  });
}

// Helper function to create a simple datasource.
function datasourceJSON(name) {
  return {
    name: "k6 test_" + name + "_" + rand.uid(),
    type: name,
    url: "http://localhost:25519/",
    access: "proxy",
    basicAuth: false,
  };
}
