import http from "k6/http";
import { check } from "k6";

import { url } from "./env.js";
import { rand } from "./util.js";

/**
 * Create multiple teams.
 *
 * @param {number} num The number of teams to create.
 * @returns {{teamIds: number[]}} Identifiers for created teams.
 */
export function createTeams(num) {
  console.info(`creating ${num} teams...`);

  // Create some teams.
  const teams = [];
  rand.strings(teams, num);

  // Create teams in Grafana.
  const teamIds = teams.map((t) => {
    let res = http.post(url + "/api/teams", JSON.stringify(teamJSON(t)), {
      tags: "create",
      headers: { "Content-Type": "application/json" },
    });
    check(res, {
      "create team status is 200": (r) => r.status === 200,
    });
    return res.json("teamId");
  });

  return { teamIds };
}

/**
 * Delete the provided set of teams.
 *
 * @param {number[]} teamIds Identifiers for teams to delete.
 */
export function deleteTeams(teamIds) {
  console.info(`deleting ${teamIds.length} teams...`);
  // Pick up our list of ids from the 'data' structure and create a list of batched DELETE HTTP requests.
  const responses = teamIds.map((i) => {
    return http.del(url + "/api/teams/" + i, null, {
      tags: { op: "delete" },
    });
  });

  responses.forEach((res) => {
    check(res, {
      "delete team status is status 200": (r) => r.status === 200,
    });
  });
}

// Helper function for a simple team.
// orgId is an optional field.
function teamJSON(name) {
  return {
    name: name,
    email: name + "@example.org",
  };
}
