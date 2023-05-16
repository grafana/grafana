import http from "k6/http";
import { check } from "k6";

import { url } from "./env.js";
import { rand } from "./util.js";

export class Orgs {
  /**
   * Create orgs.
   *
   * @param {number} num Number of orgs to create.
   * @returns {{orgIds: number[]}} Identifiers for created orgs.
   */
  static create(num) {
    console.info(`creating ${num} orgs...`);

    // Create org data structure.
    const orgs = [];
    rand.strings(orgs, num);

    // Create orgs in Grafana.
    const orgIds = orgs.map((o) => {
      let res = http.post(url + "/api/orgs", JSON.stringify({ name: o }), {
        tags: "create",
        headers: { "Content-Type": "application/json" },
      });
      check(res, {
        "create org status is 200": (r) => r.status === 200,
      });
      return res.json("orgId");
    });

    return { orgIds };
  }

  /**
   * Deletes multiple organizations.
   *
   * @param {number[]} orgIds List of organization identifiers for orgs to delete.
   */
  static del(orgIds) {
    console.info(`deleting ${orgIds.length} orgs...`);
    // Pick up our list of ids from the 'data' structure and create a list DELETE HTTP requests.
    const responses = orgIds.map((i) => {
      return http.del(url + "/api/orgs/" + i, null, {
        tags: { op: "delete" },
      });
    });

    responses.forEach((res) => {
      check(res, {
        "delete org status is status 200": (r) => r.status === 200,
      });
    });
  }

}
